-- Enforce strict room allowlist:
-- Floor 1: 798/1 - 798/15
-- Floors 2..8: 3201-3232 .. 3801-3832

DO $$
BEGIN
  -- Room.number must always follow approved pattern
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Room_number_allowed_ck'
  ) THEN
    ALTER TABLE "Room"
      ADD CONSTRAINT "Room_number_allowed_ck"
      CHECK (
        "number" ~ '^798/(?:[1-9]|1[0-5])$'
        OR
        "number" ~ '^3[2-8](?:0[1-9]|[12][0-9]|3[0-2])$'
      );
  END IF;

  -- Line bindings must also target approved room numbers
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LineBinding_roomNumber_allowed_ck'
  ) THEN
    ALTER TABLE "LineBinding"
      ADD CONSTRAINT "LineBinding_roomNumber_allowed_ck"
      CHECK (
        "roomNumber" ~ '^798/(?:[1-9]|1[0-5])$'
        OR
        "roomNumber" ~ '^3[2-8](?:0[1-9]|[12][0-9]|3[0-2])$'
      );
  END IF;

  -- Registration requests must reference only approved room numbers
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RegistrationRequest_roomNumber_allowed_ck'
  ) THEN
    ALTER TABLE "RegistrationRequest"
      ADD CONSTRAINT "RegistrationRequest_roomNumber_allowed_ck"
      CHECK (
        "roomNumber" ~ '^798/(?:[1-9]|1[0-5])$'
        OR
        "roomNumber" ~ '^3[2-8](?:0[1-9]|[12][0-9]|3[0-2])$'
      );
  END IF;
END $$;

