import { DISMISS_STORAGE_PREFIX } from "./constants";
import type { SiteAnnouncement } from "./types";

function storageKey(announcement: SiteAnnouncement): string {
  return `${DISMISS_STORAGE_PREFIX}${announcement._id}:${announcement.updatedAt}`;
}

export function isAnnouncementDismissed(announcement: SiteAnnouncement): boolean {
  try {
    return localStorage.getItem(storageKey(announcement)) === "1";
  } catch {
    return false;
  }
}

export function dismissAnnouncement(announcement: SiteAnnouncement): void {
  try {
    localStorage.setItem(storageKey(announcement), "1");
  } catch {
    // Private mode / blocked storage — session hide still works via React state.
  }
}
