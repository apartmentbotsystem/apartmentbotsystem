import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

export const runtime = "nodejs"

function startOfUTCDate(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}
function daysAgoUTC(n: number): Date {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() - n)
  return startOfUTCDate(now)
}

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const todayStart = startOfUTCDate(new Date())
  const todayEnd = new Date(todayStart)
  todayEnd.setUTCHours(23, 59, 59, 999)
  const last7Start = daysAgoUTC(7)

  const audits = await prisma.automationAudit.findMany({
    where: { createdAt: { gte: last7Start } },
    orderBy: { createdAt: "desc" },
    take: 2000,
  })
  type Audit = Awaited<ReturnType<typeof prisma.automationAudit.findMany>>[number]
  const auditsToday = audits.filter((a) => a.createdAt >= todayStart && a.createdAt <= todayEnd)
  const approvalIds = Array.from(new Set(audits.map((a) => a.approvalId)))
  const approvals = await prisma.automationApproval.findMany({ where: { id: { in: approvalIds } } })
  type Approval = Awaited<ReturnType<typeof prisma.automationApproval.findMany>>[number]
  const typeByApproval = new Map<string, string>()
  for (const ap of approvals) {
    const snap = ap.proposalSnapshot as unknown as { type?: string }
    if (snap?.type) typeByApproval.set(ap.id, snap.type)
  }
  function countByAction(rows: Audit[], action: string): number {
    return rows.filter((a) => String(a.action) === action).length
  }
  const autoApproved7 = countByAction(audits, "AUTO_APPROVED")
  const autoExecuted7 = countByAction(audits, "AUTO_EXECUTED")
  const skipped7 = countByAction(audits, "SKIP")
  const failed7 = countByAction(audits, "FAIL")
  const autoApprovedToday = countByAction(auditsToday, "AUTO_APPROVED")
  const autoExecutedToday = countByAction(auditsToday, "AUTO_EXECUTED")
  const skippedToday = countByAction(auditsToday, "SKIP")
  const failedToday = countByAction(auditsToday, "FAIL")
  const lastAutoRunAt =
    audits.find((a) => String(a.action) === "AUTO_EXECUTED" || String(a.action) === "AUTO_APPROVED")?.createdAt?.toISOString() || null

  const perTypeMap = new Map<string, { autoApproved: number; autoExecuted: number; skipped: number; failed: number }>()
  for (const a of audits) {
    const t = typeByApproval.get(a.approvalId) || "UNKNOWN"
    const cur = perTypeMap.get(t) || { autoApproved: 0, autoExecuted: 0, skipped: 0, failed: 0 }
    if (String(a.action) === "AUTO_APPROVED") cur.autoApproved += 1
    else if (String(a.action) === "AUTO_EXECUTED") cur.autoExecuted += 1
    else if (String(a.action) === "SKIP") cur.skipped += 1
    else if (String(a.action) === "FAIL") cur.failed += 1
    perTypeMap.set(t, cur)
  }
  const perType = Array.from(perTypeMap.entries()).map(([proposalType, counts]) => ({ proposalType, counts }))

  const policies = await prisma.automationPolicy.findMany({ where: { enabled: true } })
  type Policy = Awaited<ReturnType<typeof prisma.automationPolicy.findMany>>[number]
  const enabledPolicyCount = policies.length
  const executedTodayByType = new Map<string, number>()
  for (const a of auditsToday) {
    if (String(a.action) !== "AUTO_EXECUTED") continue
    const t = typeByApproval.get(a.approvalId) || "UNKNOWN"
    executedTodayByType.set(t, (executedTodayByType.get(t) || 0) + 1)
  }
  const nearDailyLimit: Array<{ proposalType: string; executedToday: number; dailyLimit: number }> = []
  const atDailyLimit: Array<{ proposalType: string; executedToday: number; dailyLimit: number }> = []
  const enabledNoActivity: Array<{ proposalType: string }> = []
  for (const p of policies) {
    const t = String(p.proposalType)
    const exec = executedTodayByType.get(t) || 0
    if (p.dailyLimit > 0) {
      if (exec >= p.dailyLimit) {
        atDailyLimit.push({ proposalType: t, executedToday: exec, dailyLimit: p.dailyLimit })
      } else if (exec >= Math.floor(p.dailyLimit * 0.8)) {
        nearDailyLimit.push({ proposalType: t, executedToday: exec, dailyLimit: p.dailyLimit })
      }
    }
    const last7TypeCount = (perTypeMap.get(t)?.autoApproved || 0) + (perTypeMap.get(t)?.autoExecuted || 0) + (perTypeMap.get(t)?.skipped || 0) + (perTypeMap.get(t)?.failed || 0)
    if (last7TypeCount === 0) {
      enabledNoActivity.push({ proposalType: t })
    }
  }
  const payload = {
    summary: {
      today: {
        executionsToday: autoExecutedToday,
        autoApprovedCount: autoApprovedToday,
        autoExecutedCount: autoExecutedToday,
        skippedCount: skippedToday,
        failedCount: failedToday,
      },
      last7Days: {
        autoApprovedCount: autoApproved7,
        autoExecutedCount: autoExecuted7,
        skippedCount: skipped7,
        failedCount: failed7,
        lastAutoRunAt,
      },
    },
    perType,
    guardrails: {
      killSwitchEnabled: String(process.env.AUTOMATION_AUTORUN_ENABLED || "false") === "true",
      enabledPolicyCount,
      nearDailyLimit,
      atDailyLimit,
      enabledNoActivity,
    },
  }
  return respondOk(req, payload, 200)
})
