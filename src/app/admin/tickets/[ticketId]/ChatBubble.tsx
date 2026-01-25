type Props = {
  direction: "INBOUND" | "OUTBOUND"
  text: string
  time: string
}

export default function ChatBubble({ direction, text, time }: Props) {
  const isInbound = direction === "INBOUND"
  const align = isInbound ? "items-start" : "items-end"
  const bubble = isInbound ? "bg-gray-200 text-gray-900" : "bg-blue-600 text-white"
  const corner = "rounded-2xl"
  return (
    <div className={`w-full flex ${align} my-1`}>
      <div className={`max-w-[75%] ${bubble} ${corner} px-3 py-2 shadow-sm`}>
        <div className="text-sm whitespace-pre-wrap">{text}</div>
        <div className={`text-[11px] mt-1 opacity-70 ${isInbound ? "text-gray-700" : "text-white"}`}>{time}</div>
      </div>
    </div>
  )
}
