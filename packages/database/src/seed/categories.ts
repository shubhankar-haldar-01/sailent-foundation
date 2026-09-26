/**
 * The category catalogue (docs/database-architecture.md §1).
 *
 * REFERENCE DATA, not demo content: the application needs these rows to work,
 * so they are seeded in the `--reference` tier and are safe to run in
 * production.
 *
 * `key` is the stable machine identifier. `name` is what an operator sees and
 * may edit — renaming "Child Welfare" to "Children" must not break a single
 * query, which is the entire reason the two are separate columns.
 *
 * An operator can add categories through the admin UI. This list is the
 * starting set, not a closed one; that is why it is a table rather than a
 * Postgres enum.
 */

export interface CategoryDefinition {
  key: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  kind: 'program' | 'campaign' | 'both';
  displayOrder: number;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    key: 'EDUCATION',
    name: 'Education',
    slug: 'education',
    description: 'Learning support, materials and school infrastructure.',
    icon: 'book',
    kind: 'both',
    displayOrder: 10,
  },
  {
    key: 'HEALTHCARE',
    name: 'Healthcare',
    slug: 'healthcare',
    description: 'Access to basic care, medicines and maternal health support.',
    icon: 'heart',
    kind: 'both',
    displayOrder: 20,
  },
  {
    key: 'CHILD_WELFARE',
    name: 'Child Welfare',
    slug: 'child-welfare',
    description: 'Nutrition, protection and safe spaces for children.',
    icon: 'shield',
    kind: 'both',
    displayOrder: 30,
  },
  {
    key: 'WOMEN_EMPOWERMENT',
    name: 'Women Empowerment',
    slug: 'women-empowerment',
    description: 'Skills, self-help groups and enterprise support.',
    icon: 'briefcase',
    kind: 'both',
    displayOrder: 40,
  },
  {
    key: 'LIVELIHOOD',
    name: 'Livelihood',
    slug: 'livelihood',
    description: 'Training and support that creates sustainable income.',
    icon: 'briefcase',
    kind: 'both',
    displayOrder: 50,
  },
  {
    key: 'ENVIRONMENT',
    name: 'Environment',
    slug: 'environment',
    description: 'Conservation, tree planting and water work.',
    icon: 'leaf',
    kind: 'both',
    displayOrder: 60,
  },
  {
    key: 'ANIMAL_WELFARE',
    name: 'Animal Welfare',
    slug: 'animal-welfare',
    description: 'Care, protection and a better life for animals.',
    icon: 'paw',
    kind: 'both',
    displayOrder: 70,
  },
  {
    key: 'DISASTER_RELIEF',
    name: 'Disaster Relief',
    slug: 'disaster-relief',
    description: 'Emergency response during and after natural disasters.',
    icon: 'shield',
    kind: 'both',
    displayOrder: 80,
  },
  {
    key: 'FOOD_SUPPORT',
    name: 'Food Support',
    slug: 'food-support',
    description: 'Nutritious meals and food security work.',
    icon: 'sprout',
    kind: 'both',
    displayOrder: 90,
  },
  {
    key: 'CLOTHING',
    name: 'Clothing',
    slug: 'clothing',
    description: 'Warm clothing and essential supplies.',
    icon: 'shield',
    kind: 'campaign',
    displayOrder: 100,
  },
  {
    key: 'COMMUNITY_DEVELOPMENT',
    name: 'Community Development',
    slug: 'community-development',
    description: 'Infrastructure and services a whole community uses.',
    icon: 'sprout',
    kind: 'both',
    displayOrder: 110,
  },
  {
    key: 'OTHER',
    name: 'Other',
    slug: 'other',
    description: 'Work that does not fit the categories above.',
    icon: 'sprout',
    kind: 'both',
    displayOrder: 999,
  },
];
