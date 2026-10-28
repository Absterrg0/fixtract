import React, { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations, getLocale } from 'next-intl/server'
import { Facebook, Twitter, Instagram, Linkedin, Youtube, Music2 } from 'lucide-react'
import { publicListPolicyLinks, PolicyLink, CMS_RESERVED_POLICIES } from '@/lib/cms'
import { publicGetSiteSettings, SiteSettings } from '@/lib/siteSettings'

const LEGAL_SLOTS = CMS_RESERVED_POLICIES.map(({ slug, label }) => ({ slug, label }))

const MANDATORY_FALLBACKS: PolicyLink[] = CMS_RESERVED_POLICIES.map(({ slug, label, path }) => ({
  slug,
  title: label,
  path,
}))

/**
 * Footer columns. Labels live in the `footer` i18n namespace; hrefs stay in
 * code so translated labels never change the routing.
 */
const FOOTER_COLUMNS = [
  {
    title: 'columns.popularServices',
    links: [
      { label: 'links.interiorDesign', href: '/services/interior-design' },
      { label: 'links.plumbing', href: '/services/plumbing-services' },
      { label: 'links.electricalWork', href: '/services/electrical-work' },
      { label: 'links.painting', href: '/services/painting-services' },
      { label: 'links.renovation', href: '/services/home-renovation' },
    ],
  },
  {
    title: 'columns.forCustomers',
    links: [
      { label: 'links.howItWorks', href: '#how-it-works' },
      { label: 'links.findProfessionals', href: '#services' },
      { label: 'links.safetyTrust', href: '#features' },
      { label: 'links.projectIdeas', href: '#' },
    ],
  },
  {
    title: 'columns.forProfessionals',
    links: [
      { label: 'links.joinAsProfessional', href: '/join' },
      { label: 'links.successStories', href: '#professionals' },
    ],
  },
  {
    title: 'columns.company',
    links: [
      { label: 'links.about', href: '/about' },
      { label: 'links.blog', href: '/blog' },
      { label: 'links.news', href: '/news' },
      { label: 'links.faq', href: '/faq' },
    ],
  },
] as const

/** CMS reserved policy slugs → translated footer labels. */

function isSafeHttpUrl(href: string): boolean {
  try {
    const parsed = new URL(href)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const SOCIAL_DEFS: Array<{ key: keyof NonNullable<SiteSettings['socialLinks']>; name: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'facebook', name: 'Facebook', icon: Facebook },
  { key: 'twitter', name: 'Twitter', icon: Twitter },
  { key: 'instagram', name: 'Instagram', icon: Instagram },
  { key: 'linkedin', name: 'LinkedIn', icon: Linkedin },
  { key: 'tiktok', name: 'TikTok', icon: Music2 },
  { key: 'youtube', name: 'YouTube', icon: Youtube },
]

const FooterLinkColumn = ({ title, links }: { title: string; links: { name: string; href: string }[] }) => (
  <div>
    <h4 className="text-lg font-semibold text-white mb-6">{title}</h4>
    <ul className="space-y-4">
      {links.map((link) => (
        <li key={link.name}>
          <Link href={link.href} className="text-gray-300 hover:text-white hover:underline transition-colors">
            {link.name}
          </Link>
        </li>
      ))}
    </ul>
  </div>
)

export default async function Footer() {
  const t = await getTranslations('footer')
  const locale = await getLocale()
  const currentYear = new Date().getFullYear()
  const copyright = t('copyright', { year: String(currentYear) })
  const labels: Record<string, string> = {
    'privacy-policy': t('legal.privacyPolicy'),
    'terms-of-service': t('legal.termsOfService'),
    'cookie-policy': t('legal.cookiePolicy'),
    'gdpr-compliance': t('legal.gdprCompliance'),
    'platform-rules': t('legal.platformRules'),
    'self-billing-agreement': t('legal.selfBillingAgreement'),
  }

  return (
    <footer className="bg-gray-900 ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-2">
            <Link href="#hero" className="inline-flex items-center mb-6" aria-label="Fixtract">
              <Image
                src="/fixtract-logo-light.png"
                alt="Fixtract — Find. Hire. Build."
                width={220}
                height={67}
                className="h-14 w-auto"
              />
            </Link>
            <p className="text-gray-300 mb-8 leading-relaxed">
              {t('description')}
            </p>
          </div>

          {FOOTER_COLUMNS.map((section) => (
            <FooterLinkColumn
              key={section.title}
              title={t(section.title)}
              links={section.links.map((link) => ({ name: t(link.label), href: link.href }))}
            />
          ))}
        </div>
      </div>

      <Suspense fallback={<FooterMetaShell copyright={copyright} policies={MANDATORY_FALLBACKS} legalLabels={labels} settings={{ socialLinks: {} }} />}>
        <FooterMeta copyright={copyright} legalLabels={labels} locale={locale} />
      </Suspense>
    </footer>
  )
}

async function FooterMeta({
  copyright,
  legalLabels,
  locale,
}: {
  copyright: string
  legalLabels: Record<string, string>
  locale: string
}) {
  const [policies, settings] = await Promise.all([
    publicListPolicyLinks({ locale }),
    publicGetSiteSettings().catch(() => ({ socialLinks: {} } as SiteSettings)),
  ])

  const sourceLinks = [...MANDATORY_FALLBACKS, ...policies]
  const bySlug: Record<string, PolicyLink> = Object.fromEntries(
    sourceLinks.map((p) => [p.slug, p])
  )

  return <FooterMetaShell copyright={copyright} policies={Object.values(bySlug)} legalLabels={legalLabels} settings={settings} />
}

function FooterMetaShell({
  copyright,
  policies,
  legalLabels,
  settings,
}: {
  copyright: string
  policies: PolicyLink[]
  legalLabels: Record<string, string>
  settings: SiteSettings
}) {
  const bySlug: Record<string, PolicyLink> = Object.fromEntries(
    policies.map((p) => [p.slug, p])
  )

  return (
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-6">
            <p className="text-gray-400 text-sm text-center sm:text-left">
              {copyright}
            </p>
            <div className="flex items-center space-x-6">
              {SOCIAL_DEFS.map(({ key, name, icon: Icon }) => {
                const href = settings?.socialLinks?.[key]
                if (!href || !isSafeHttpUrl(href)) return null
                return (
                  <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                    <span className="sr-only">{name}</span>
                  </a>
                )
              })}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2">
            {LEGAL_SLOTS.map((slot) => {
              const match = bySlug[slot.slug]
              if (!match) return null
              return (
                <Link key={slot.slug} href={match.path} className="text-sm text-gray-400 hover:text-white hover:underline">
                  {legalLabels[slot.slug] ?? slot.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
  )
}
