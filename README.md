# Nest Pet

Nest Pet is a little companion that lives on your Mac desktop. It plays and naps on its own, notices your cursor, and can talk to you through its own speech bubble.

This team demo comes from the checkpoint before the animation and character pack changes. In the full vision, the same pet will learn how you like to be kept company and visit a public Lobby, where it can meet and interact with pets raised by other people. Long-term memory and the public Lobby are planned.

## Run the demo on your Mac

You can set it up yourself with a GitHub account and two Terminal commands.

1. **Download the project.** Sign in to GitHub with an account that has access to this private repo. Choose **Code → Download ZIP** on the repo page, or [download the demo ZIP](https://github.com/lemonduck2364/hack-the-nest-study-pet/archive/refs/heads/desktop-pet.zip). Double-click the ZIP in Finder to unpack it.
2. **Install Node.js once.** Open [the Node.js download page](https://nodejs.org/en/download), choose **24 LTS** and the **macOS Installer**, and run it. If you already have Node.js 22.12 or newer, skip the install. Open a fresh Terminal window afterward.
3. **Open the project folder in Terminal.** In Finder, find the **desktop** folder inside the unzipped project. In Terminal, type `cd` followed by a space. Drag the **desktop** folder into Terminal and press **Return**. You should now be in the folder containing `package.json`.
4. **Install and start.** Run these lines one at a time. Wait for the first to finish before running the second. The first startup may download Electron, which runs the app, so stay connected to the internet.

   ```sh
   npm ci
   npm start
   ```

Look near the lower-right corner of your desktop. If you can't find the pet, choose **◉ → Bring back** from the Mac menu bar. Keep Terminal open while the pet runs. Use **◉ → Quit** to close it. Next time, open Terminal in the same **desktop** folder and run only `npm start`.

## Let the pet talk

Play, naps and cursor interactions work without an AI key. To try a live response:

1. Sign in to [Google AI Studio](https://aistudio.google.com/api-keys). Use **Create API key** if you don't already have a key, then copy it. [Google's setup guide](https://ai.google.dev/gemini-api/docs/api-key) covers project setup if asked.
2. On the Mac, select **◉ → Connection…**. Paste your key in the password field, click **Set key**, and close Connection.
3. Choose **◉ → Chat**, type a short line such as “I'm taking a little break,” and press **Return**. The response shows up in the pet's speech bubble.

Set the key before recording. Keep it out of GitHub, screenshots and messages. The app clears the key on restart. Chat sends the typed message and recent conversation context to Google, so use a short demo line.

## Rehearse the demo

1. Start on the actual Mac desktop. Let the pet play, then move your cursor nearby and show it noticing you.
2. Send a short message and let the audience see its reply in the bubble. Record a backup of this flow before the presentation in case the network is slow.
3. Use one visual to show where the product is going. The same pet goes from your desktop into a shared public Lobby, meets other users' pets, plays or talks with them, and comes home. Label this scene as the planned experience.

The included character art is for private, noncommercial team review. Use original or cleared art for public presentation materials. See [asset credits](desktop/THIRD_PARTY_NOTICES.md).

## If you get stuck

| What you see | What to try |
| --- | --- |
| GitHub shows 404 | Check that you're signed in and have access to the private repo. |
| Terminal says `command not found: npm` | Install Node.js and reopen Terminal. |
| Terminal can't find `package.json` | Repeat step 3 using the **desktop** folder inside the download. |
| The pet is running but you can't see it | Return to a regular desktop and choose **◉ → Bring back**. |
| The pet moves but chat doesn't reply | Check the internet connection and the key in **◉ → Connection…**. You can continue rehearsing with the pet's local interactions. |

The active app is in [`desktop/`](desktop/). The team's previous browser prototype and its original instructions are preserved in [`archive/original-web-prototype/`](archive/original-web-prototype/README.md).
