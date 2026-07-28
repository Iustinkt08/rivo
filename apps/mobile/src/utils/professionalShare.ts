// Share payload for a professional's public profile.
//
// For now we only have the custom scheme deep link (navira://professional/:id,
// scheme registered in app.json). Universal https links (e.g.
// https://navira.ro/professional/:id with AASA / assetlinks verification) land
// later — once they do, `url` should switch to the https form and keep the
// deep link as fallback.

export const PROFESSIONAL_DEEP_LINK_PREFIX = 'navira://professional/';

export interface ProfessionalSharePayload {
  url: string;
  message: string;
}

/** Builds the RN Share payload (Romanian copy) for a professional profile. */
export function buildProfessionalShare(
  staffId: string,
  fullName?: string,
): ProfessionalSharePayload {
  const url = `${PROFESSIONAL_DEEP_LINK_PREFIX}${staffId}`;
  const name = fullName?.trim();
  const message = name
    ? `Descoperă profilul lui ${name} pe NAVIRA: ${url}`
    : `Descoperă acest specialist pe NAVIRA: ${url}`;
  return { url, message };
}
