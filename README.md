# AllSee

One page with every site and project: live address, admin links, local dev link, GitHub repo and Work folder.
No login. Live at https://lawebs.co.il/allsee/ (noindex).

- Open locally: double-click `index.html`.
- Add or edit a project: edit the `SITES` array in `index.html` and add a screenshot to `shots/`.
- Refresh screenshots: see the first line of `tools/refresh-shots.cjs`.
- Publish: `.\deploy.ps1` (commit + push to GitHub, then production). `-Target GitHub` or `-Target Prod` runs one half.
