import fs from 'fs/promises';
import * as core from '@actions/core';
import * as github from '@actions/github';

const deeplAuthKey = core.getInput('deeplAuthKey', { required: true });
const sourceFile = core.getInput('sourceFile', { required: true });
const sourceLang = core.getInput('sourceLang', { required: true });
const targetFile = core.getInput('targetFile', { required: true });
const targetLang = core.getInput('targetLang', { required: true });
const createPullRequest = core.getBooleanInput('createPullRequest', { required: false });

async function main() {
  const content = await fs.readFile(sourceFile, 'utf8');

  const response = await fetch('https://api.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Authorization": `DeepL-Auth-Key ${deeplAuthKey}`
    },
    body: JSON.stringify({
      "text": [
        content,
      ],
      "source_lang": sourceLang,
      "target_lang": targetLang
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to translate: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (!data || !data.translations || data.translations.length === 0) {
    throw new Error('No translations found in the response');
  }

  const translatedText = data.translations[0].text;

  await fs.writeFile(targetFile, translatedText, 'utf8');

  if (!createPullRequest) {
    core.info(`Translation successful! Translated text written to ${targetFile}`);
    core.setOutput('exitCode', 0);
    return;
  }

  const octokit = github.getOctokit(core.getInput('githubToken', { required: true }));
  const { owner, repo } = github.context.repo;
  const branchName = `translate-${sourceLang}-to-${targetLang}`;
  const baseBranch = github.context.ref.replace('refs/heads/', '');

  // Create a new branch
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: github.context.sha
  });

}

main().catch((error) => {
  core.setFailed(`Action failed with error: ${error.message}`);
});
