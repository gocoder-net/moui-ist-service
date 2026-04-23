export function getCreatorVerificationLabel(verified: boolean | null | undefined) {
  return verified ? '작가 인증' : '작가 인증 전';
}

export function getCreatorVerificationStatusText(verified: boolean | null | undefined) {
  return verified ? '인증' : '인증 전';
}

export function getCreatorVerificationResetLabel() {
  return '작가 인증 전';
}
