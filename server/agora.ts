import { RtcTokenBuilder, RtcRole } from "agora-token";

const APP_ID = process.env.AGORA_APP_ID!;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE!;

// String userId (UUID) ko stable numeric uid me convert karta hai
// Agora ka uid hamesha 32-bit unsigned integer hona chahiye
function stringToNumericUid(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash === 0 ? 1 : hash;
}

export function generateAgoraToken(channelName: string, userId: string) {
  if (!APP_ID || !APP_CERTIFICATE) {
    throw new Error("AGORA_APP_ID or AGORA_APP_CERTIFICATE missing in env");
  }
  const uid = stringToNumericUid(userId);
  const expirationTimeInSeconds = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    privilegeExpiredTs,
    privilegeExpiredTs
  );

  return { token, appId: APP_ID, channelName, uid, expiresAt: privilegeExpiredTs };
}