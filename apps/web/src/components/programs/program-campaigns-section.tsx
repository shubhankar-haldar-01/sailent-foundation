import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CampaignCard } from '@/components/campaigns/campaign-card';

import type { Campaign, Program } from '@/lib/mock/types';

interface ProgramCampaignsSectionProps {
  program: Program;
  campaigns: Campaign[];
}

export function ProgramCampaignsSection({ program, campaigns }: ProgramCampaignsSectionProps) {
  // Curated showcase campaigns matching the Education program
  const educationCampaigns: Campaign[] = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      slug: 'school-kits-jharkhand',
      title: 'Educate Rural Children',
      shortDescription:
        'Provide school kits with essential learning materials for children in underserved communities.',
      programName: 'Education',
      programSlug: 'education',
      category: 'Education',
      location: 'Ranchi, Jharkhand',
      goalAmount: 1000000 * 100, // ₹10,00,000 in paise
      amountRaised: 545700 * 100, // ₹5,45,700 in paise
      donorCount: 397,
      startsAt: '2026-06-01T00:00:00+05:30',
      endsAt: '2026-11-30T00:00:00+05:30',
      status: 'active',
      hasProducts: true,
      isFeatured: true,
      beneficiaryTarget: 500,
      beneficiariesReached: 354,
      beneficiaryContext:
        'Children entering classes 1 to 8 at fourteen government schools across Ranchi district.',
      story: [],
      products: [],
      updates: [],
      faqs: [],
      documents: [],
      impactNotes: [],
      gallery: [],
      cover: {
        seed: 'campaign-school-kits',
        url: '/images/community-classroom.webp',
        alt: 'Educate Rural Children',
      },
      progress: {
        goal: 1000000 * 100,
        raised: 545700 * 100,
        remaining: 454300 * 100,
        percent: 55,
        rawPercent: 55,
        goalReached: false,
        surplus: 0,
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000021',
      slug: campaigns[0]?.slug ?? 'school-kits-jharkhand',
      title: 'After-school Learning Support',
      shortDescription:
        'Help us run after-school classes to strengthen foundational learning for children who need extra support.',
      programName: 'Education',
      programSlug: 'education',
      category: 'Education',
      location: 'Gaya, Bihar',
      goalAmount: 500000 * 100, // ₹5,00,000 in paise
      amountRaised: 320000 * 100, // ₹3,20,000 in paise
      donorCount: 218,
      startsAt: '2026-06-01T00:00:00+05:30',
      endsAt: '2026-11-30T00:00:00+05:30',
      status: 'active',
      hasProducts: true,
      isFeatured: true,
      beneficiaryTarget: 300,
      beneficiariesReached: 190,
      beneficiaryContext: 'Children attending evening support centres.',
      story: [],
      products: [],
      updates: [],
      faqs: [],
      documents: [],
      impactNotes: [],
      gallery: [],
      cover: {
        seed: 'campaign-afterschool',
        url: '/images/campaign-afterschool-support.webp',
        alt: 'After-school Learning Support',
      },
      progress: {
        goal: 500000 * 100,
        raised: 320000 * 100,
        remaining: 180000 * 100,
        percent: 64,
        rawPercent: 64,
        goalReached: false,
        surplus: 0,
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000022',
      slug: campaigns[0]?.slug ?? 'school-kits-jharkhand',
      title: 'Improve Classroom Essentials',
      shortDescription:
        'Support basic classroom resources to create a better and more engaging learning environment.',
      programName: 'Education',
      programSlug: 'education',
      category: 'Education',
      location: 'Kalahandi, Odisha',
      goalAmount: 500000 * 100, // ₹5,00,000 in paise
      amountRaised: 275000 * 100, // ₹2,75,000 in paise
      donorCount: 189,
      startsAt: '2026-06-01T00:00:00+05:30',
      endsAt: '2026-11-30T00:00:00+05:30',
      status: 'active',
      hasProducts: true,
      isFeatured: true,
      beneficiaryTarget: 250,
      beneficiariesReached: 140,
      beneficiaryContext: 'Government primary school classrooms.',
      story: [],
      products: [],
      updates: [],
      faqs: [],
      documents: [],
      impactNotes: [],
      gallery: [],
      cover: {
        seed: 'campaign-classroom-essentials',
        url: '/images/campaigns-hero-education.webp',
        alt: 'Improve Classroom Essentials',
      },
      progress: {
        goal: 500000 * 100,
        raised: 275000 * 100,
        remaining: 225000 * 100,
        percent: 55,
        rawPercent: 55,
        goalReached: false,
        surplus: 0,
      },
    },
  ];

  // Dynamic campaigns for other programs or when database campaigns are available
  const displayCampaigns: Campaign[] =
    program.slug === 'education' ? educationCampaigns : campaigns.length > 0 ? campaigns : [];

  if (displayCampaigns.length === 0) {
    return null;
  }

  return (
    <section
      id="campaigns"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
    >
      {/* Section Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-2xl font-black tracking-tight text-[#0A2540] sm:text-3xl">
            Campaigns supporting this program
          </h2>
          <p className="mt-1.5 text-sm text-[#486581] sm:text-base">
            Support ongoing campaigns that directly contribute to our {program.name} program.
          </p>
        </div>
        <Link
          href={`/campaigns?program=${program.slug}`}
          className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-[#EB6A1F] transition-colors hover:text-[#D45914] sm:self-auto sm:text-base"
        >
          View all campaigns
          <ArrowRight className="size-4 stroke-[2.5]" aria-hidden="true" />
        </Link>
      </div>

      {/* 3-Column Card Grid using global CampaignCard */}
      <div className="mt-7 grid grid-cols-1 items-stretch gap-6 sm:mt-8 sm:gap-7 md:grid-cols-2 lg:grid-cols-3">
        {displayCampaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} className="w-full" showStatus />
        ))}
      </div>
    </section>
  );
}
