export function balanceHorizontalInsets(
  width: number,
  { left, right }: { left: number; right: number },
  minContentWidth: number,
) {
  const roomToBalance = Math.max(0, width - left - right - minContentWidth);
  return {
    left: Math.max(left, Math.min(right, left + roomToBalance)),
    right: Math.max(right, Math.min(left, right + roomToBalance)),
  };
}
