import config from '@sailent/config/eslint/next';

export default [...config, { ignores: ['.next/**', 'next-env.d.ts', 'e2e/**'] }];
