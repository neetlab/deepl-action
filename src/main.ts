import fs from 'fs/promises';
import * as core from '@actions/core';
import * as github from '@actions/github';

const deeplAuthKey = core.getInput('deepl-auth-key', { required: true });
const githubToken = core.getInput('github-token', { required: true });
const sourceFile = core.getInput('source-file', { required: true });
const sourceLang = core.getInput('source-lang', { required: true });
const targetFile = core.getInput('target-file', { required: true });
const targetLang = core.getInput('target-lang', { required: true });

async function main() {
  const content = await fs.readFile(sourceFile, 'utf8');

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
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

  // --------------------------------------------
  // コミット
  // --------------------------------------------
  const octokit = github.getOctokit(githubToken);

  const { owner, repo } = github.context.repo;
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const baseBranch = repoData.default_branch;

  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`
  });

  const baseSha = refData.object.sha;

  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: baseSha,
  });

  const baseTreeSha = commitData.tree.sha;

  const blob = await octokit.rest.git.createBlob({
    owner,
    repo,
    content: translatedText,
    encoding: "utf-8",
  });

  const tree = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: [
      {
        path: targetFile,
        mode: "100644",
        type: "blob",
        sha: blob.data.sha,
      },
    ],
  });

  const newCommit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: `Translate ${targetFile}`,
    tree: tree.data.sha,
    parents: [baseSha],
  });

  const branchName = `auto/update-${Date.now()}`;
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: newCommit.data.sha,
  });

  await octokit.rest.pulls.create({
    owner,
    repo,
    title: `Translate ${targetFile}`,
    head: branchName,
    base: baseBranch,
    body: "This PR was created automatically via REST API.",
  });

  console.log("Pull request created!");
}

main().catch((error) => {
  core.setFailed(`Action failed with error: ${error.message}`);
});
