import conventional from 'cz-conventional-changelog';
import { execSync } from 'child_process';

function getNxProjects() {
  try {
    const output = execSync('nx show projects --json', {
      stdio: ['ignore', 'pipe', 'ignore'],
      // pnpm injects bin paths into the env so `nx` will run from node_modules
      env: process.env,
    });

    return JSON.parse(output.toString()).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export function prompter(cz, commit) {
  const projects = getNxProjects();

  const originalPrompt = cz.prompt.bind(cz);

  cz.prompt = function Prompt(questions) {
    const newQuestions = questions.map((question) => {
      if (question.name === 'scope') {
        return {
          type: 'list',
          name: question.name,
          message: 'Which project is affected by this change?',
          choices: [
            { name: 'repo', value: 'repo' },
            ...projects.map((project) => ({
              name: project,
              value: project,
            })),
          ],
        };
      }
      return question;
    });

    return originalPrompt(newQuestions);
  };

  return conventional.prompter(cz, commit);
}
