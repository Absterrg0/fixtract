export type AnnouncementType = "top_bar" | "modal" | "exit_intent";
export type AnnouncementFrequency =
  | "once"
  | "once_week"
  | "once_3_days"
  | "once_day"
  | "once_session"
  | "once_pageview";

export interface SiteAnnouncement {
  _id: string;
  name: string;
  type: AnnouncementType;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
  discountCode?: string;
  activeCountries: string[];
  locale: string;
  frequency: AnnouncementFrequency;
  delaySeconds: number;
  dismissible: boolean;
  requireMarketingConsent: boolean;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
}
