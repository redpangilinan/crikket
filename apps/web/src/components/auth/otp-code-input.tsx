"use client"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@crikket/ui/components/ui/input-otp"

type OtpCodeInputProps = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  isInvalid?: boolean
  disabled?: boolean
  length?: number
}

export function OtpCodeInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  isInvalid = false,
  disabled = false,
  length = 6,
}: OtpCodeInputProps) {
  const hasSixDigits = length === 6
  const otpPositions = Array.from({ length }, (_, position) => position)

  return (
    <InputOTP
      aria-invalid={isInvalid}
      containerClassName="w-full justify-center"
      disabled={disabled}
      id={id}
      maxLength={length}
      name={name}
      onBlur={onBlur}
      onChange={onChange}
      value={value}
    >
      {hasSixDigits ? (
        <>
          <InputOTPGroup>
            <InputOTPSlot className="size-11 text-base" index={0} />
            <InputOTPSlot className="size-11 text-base" index={1} />
            <InputOTPSlot className="size-11 text-base" index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot className="size-11 text-base" index={3} />
            <InputOTPSlot className="size-11 text-base" index={4} />
            <InputOTPSlot className="size-11 text-base" index={5} />
          </InputOTPGroup>
        </>
      ) : (
        <InputOTPGroup>
          {otpPositions.map((position) => (
            <InputOTPSlot
              className="size-11 text-base"
              index={position}
              key={position}
            />
          ))}
        </InputOTPGroup>
      )}
    </InputOTP>
  )
}
