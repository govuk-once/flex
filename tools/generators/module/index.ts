import { IModuleGeneratorSchema } from './schema';
import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
} from '@nx/devkit';

export default async function (tree: Tree, schema: IModuleGeneratorSchema) {
  const projectName = schema.projectName;
  const projectRoot = `modules/${projectName}`;

  // Create project.json file
  tree.write(
    `${projectRoot}/project.json`,
    JSON.stringify({
      name: `@modules/${projectName}`,
      sourceRoot: `${projectRoot}/src`,
      projectType: 'application',
      implicitDependencies: ['utils'],
      targets: {
        build: {
          executor: `@nx/esbuild:esbuild`,
          options: {
            outputPath: `dist/${projectRoot}`,
            main: `${projectRoot}/src/index.ts`,
            tsConfig: `${projectRoot}/tsconfig.json`,
          },
        },
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: [`${projectRoot}/**/*.ts`],
          },
        },
        test: {
          executor: '@nx/vite:test',
          options: {
            config: 'vitest.config.ts',
            passWithNoTests: true,
          },
        },
      },
    }),
  );

  generateFiles(tree, joinPathFragments(__dirname, './files'), projectRoot, {
    projectName,
  });

  await formatFiles(tree);
}
