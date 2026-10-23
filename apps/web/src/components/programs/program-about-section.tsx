import { BookOpen, Users } from 'lucide-react';
import { Card } from '@sailent/ui';

import type { Program } from '@/lib/mock/types';

interface ProgramAboutSectionProps {
  program: Program;
}

export function ProgramAboutSection({ program }: ProgramAboutSectionProps) {
  const aboutText =
    program.slug === 'education'
      ? 'Our Education program focuses on ensuring that children in underserved communities have access to quality learning opportunities, necessary school resources, and safer learning environments. We work with local communities, schools and partners to remove barriers to education and help every child continue their learning journey.'
      : program.shortDescription ||
        `Our ${program.name} program focuses on ensuring that communities have access to quality opportunities, necessary resources, and safer environments. We work with local communities, schools and partners to remove barriers and create lasting positive change.`;

  const challengeText =
    program.slug === 'education'
      ? 'Many children in underserved communities struggle to stay in school due to poverty, lack of learning resources, and inadequate infrastructure. This often leads to irregular attendance and early dropouts, limiting their future opportunities.'
      : program.problem ||
        'Many individuals in underserved communities face significant challenges due to poverty, limited resources, and inadequate local infrastructure, which limits their future opportunities.';

  const approachText =
    program.slug === 'education'
      ? 'We provide academic support, essential learning materials, and safer school environments in partnership with local communities and schools. Our focus is on practical, sustainable support that helps children learn and stay in school.'
      : program.approach ||
        'We provide dedicated support, essential materials, and sustainable solutions in partnership with local communities and partners to ensure long-term positive impact.';

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <Card className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] sm:rounded-[28px] sm:p-8 lg:rounded-3xl lg:p-10">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-0">
          {/* Left Column: Heading & About Text */}
          <div className="lg:col-span-6 lg:border-r lg:border-slate-200/80 lg:pr-10 xl:pr-12">
            <h2 className="font-display text-2xl font-black tracking-tight text-[#0A2540] sm:text-[1.75rem]">
              About this program
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#486581] sm:mt-5 sm:text-[15px]">
              {aboutText}
            </p>
          </div>

          {/* Right Column: The Challenge & Our Approach */}
          <div className="flex flex-col justify-center space-y-6 sm:space-y-7 lg:col-span-6 lg:pl-10 xl:pl-12">
            {/* The Challenge */}
            <div className="sm:gap-4.5 flex items-start gap-4">
              <div
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0E6] text-[#EB6A1F] sm:size-12"
              >
                <BookOpen className="size-5 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-[#0A2540] sm:text-lg">
                  The challenge
                </h3>
                <p className="text-xs leading-relaxed text-[#486581] sm:text-[13.5px]">
                  {challengeText}
                </p>
              </div>
            </div>

            {/* Our Approach */}
            <div className="sm:gap-4.5 flex items-start gap-4">
              <div
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EBF5FF] text-[#1E88E5] sm:size-12"
              >
                <Users className="size-5 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-[#0A2540] sm:text-lg">
                  Our approach
                </h3>
                <p className="text-xs leading-relaxed text-[#486581] sm:text-[13.5px]">
                  {approachText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
