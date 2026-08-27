Rahalati same-app PWA hotfix

Upload all files/folders to the repository root, replacing files with the same paths.
Key fix: every manifest now uses id=/, start_url=/, scope=/ so all release folders remain inside one installed PWA.
The 3.2.0 app.js also resolves release URLs from the app root and uses location.replace.
