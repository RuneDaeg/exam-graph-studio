import type { Graph } from './graph';
import { physicsTemplates } from './exam-physics';
import { chemistryTemplates } from './exam-chemistry';
import { biologyTemplates } from './exam-biology';
import { earthTemplates } from './exam-earth';
import { integratedTemplates } from './exam-integrated';

export const scienceCourses = ['통합과학', '물리학Ⅰ', '물리학Ⅱ', '화학Ⅰ', '화학Ⅱ', '생명과학Ⅰ', '생명과학Ⅱ', '지구과학Ⅰ', '지구과학Ⅱ'] as const;
export type ScienceCourse = typeof scienceCourses[number];
export type ExamTemplate = {
  id: string;
  course: ScienceCourse;
  name: string;
  description: string;
  tags: string[];
  graph: Graph;
  source: {
    agency: string;
    academicYear: number;
    conductedOn: string;
    exam: string;
    grade?: '고1';
    resourceType?: 'pdf' | 'zip';
    question: number;
    pdfPage: number;
    pdfUrl: string;
    landingUrl: string;
  };
  adaptation: { kind: 'normalized' | 'redrawn'; note: string };
};

export const examTemplates: ExamTemplate[] = [
  ...physicsTemplates, ...chemistryTemplates, ...biologyTemplates, ...earthTemplates, ...integratedTemplates,
];

export function sourceTitle(template: ExamTemplate) {
  const { academicYear, exam, grade, question } = template.source;
  return `${academicYear}학년도 ${grade ? grade + ' ' : ''}${exam} · ${question}번`;
}

export function filterExamTemplates(course: string, query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return examTemplates.filter(template =>
    (course === '전체' || template.course === course) && terms.every(term =>
      [template.name, template.description, template.course, ...template.tags,
        sourceTitle(template), template.source.conductedOn].join(' ').toLocaleLowerCase().includes(term),
    ),
  );
}
