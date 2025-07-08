"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const deeplAuthKey = core.getInput('deepl-auth-key', { required: true });
const githubToken = core.getInput('github-token', { required: true });
const sourceFile = core.getInput('source-file', { required: true });
const sourceLang = core.getInput('source-lang', { required: true });
const targetFile = core.getInput('target-file', { required: true });
const targetLang = core.getInput('target-lang', { required: true });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const content = yield promises_1.default.readFile(sourceFile, 'utf8');
        const response = yield fetch('https://api.deepl.com/v2/translate', {
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
            const errorText = yield response.text();
            throw new Error(`Failed to translate: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const data = yield response.json();
        if (!data || !data.translations || data.translations.length === 0) {
            throw new Error('No translations found in the response');
        }
        const translatedText = data.translations[0].text;
        // --------------------------------------------
        // コミット
        // --------------------------------------------
        const octokit = github.getOctokit(githubToken);
        const { owner, repo } = github.context.repo;
        const { data: repoData } = yield octokit.rest.repos.get({ owner, repo });
        const baseBranch = repoData.default_branch;
        const { data: refData } = yield octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${baseBranch}`
        });
        const baseSha = refData.object.sha;
        const { data: commitData } = yield octokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: baseSha,
        });
        const baseTreeSha = commitData.tree.sha;
        const blob = yield octokit.rest.git.createBlob({
            owner,
            repo,
            content: translatedText,
            encoding: "utf-8",
        });
        const tree = yield octokit.rest.git.createTree({
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
        const newCommit = yield octokit.rest.git.createCommit({
            owner,
            repo,
            message: `Translate ${targetFile}`,
            tree: tree.data.sha,
            parents: [baseSha],
        });
        const branchName = `auto/update-${Date.now()}`;
        yield octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: newCommit.data.sha,
        });
        yield octokit.rest.pulls.create({
            owner,
            repo,
            title: `Translate ${targetFile}`,
            head: branchName,
            base: baseBranch,
            body: "This PR was created automatically via REST API.",
        });
        console.log("Pull request created!");
    });
}
main().catch((error) => {
    core.setFailed(`Action failed with error: ${error.message}`);
});
