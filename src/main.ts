import fs from 'fs/promises';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { diff } from './utils/diff';
import { getIn, setIn } from './utils/get_in';
import { zip } from './utils/zip';


const deeplAuthKey = core.getInput('deepl-auth-key', { required: true });
const githubToken = core.getInput('github-token', { required: true });
const sourceFile = core.getInput('source-file', { required: true });
const sourceLang = core.getInput('source-lang', { required: true });
const targetFile = core.getInput('target-file', { required: true });
const targetLang = core.getInput('target-lang', { required: true });

const readFileAsJsonOrDefault = async (filePath: string, defaultValue: Record<string, unknown>): Promise<Record<string, unknown>> => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return defaultValue;
    }
    throw error;
  }
}

const translate = async (text: string[], sourceLang: string, targetLang: string): Promise<string[]> => {
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Authorization": `DeepL-Auth-Key ${deeplAuthKey}`
    },
    body: JSON.stringify({
      "text": text,
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

  return data.translations.map((translation: { text: string }) => translation.text);
}

type ResultEntryAdded = {
  type: 'added';
  key: string;
  source: string;
  target: string;
}

type ResultEntryRemoved = {
  type: 'removed';
  key: string;
  source: null;
  target: string;
}

type ResultEntry = ResultEntryAdded | ResultEntryRemoved;

const generateMarkdownTable = (entries: ResultEntry[]): string => {
  let result = "";

  result += `| 種別 | キー | ${sourceLang} | ${targetLang} |\n`;
  result += "| :--- | :--- | :--- | :--- |\n";

  for (const entry of entries) {
    const type = entry.type === 'added' ? '追加' : '削除';
    result += `| ${type} | \`${entry.key}\` | ${entry.source} | ${entry.target} |\n`;
  }

  return result;
};

async function main() {
  const source = await readFileAsJsonOrDefault(sourceFile, {});
  const target = await readFileAsJsonOrDefault(targetFile, {});

  const differences = diff(target, source);
  const entries: ResultEntry[] = [];

  const textsToTranslate = differences.added.map((added) => getIn(source, added)) as string[];
  const translations = await translate(textsToTranslate, sourceLang, targetLang);

  for (const [path, translation] of zip(differences.added, translations)) {
    setIn(target, path, translation);
    entries.push({
      type: 'added',
      key: path.join('.'),
      source: getIn(source, path) as string,
      target: translation,
    });
  }

  for (const removed of differences.removed) {
    entries.push({
      type: 'removed',
      key: removed.join('.'),
      source: null,
      target: getIn(target, removed) as string,
    });
    setIn(target, removed, undefined);
  }

  const translatedText = JSON.stringify(target, null, 2);

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
    body: `This PR was created automatically via neetlab/deepl-action.\n${generateMarkdownTable(entries)}`,
  });

  console.log("Pull request created!");
}

main().catch((error) => {
  core.setFailed(`Action failed with error: ${error.message}`);
});
