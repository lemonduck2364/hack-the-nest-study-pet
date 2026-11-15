# Nest Pet

Nest Pet is a little companion that lives on your Mac desktop. It plays and naps on its own, notices your cursor, and can talk to you through its own speech bubble.

This team build has ten activities, cursor attention, and an optional Gemini-powered chat. The latest update remembers your Gemini key on this Mac, shows a spinner while a reply is on its way, and keeps the input ready for another message after a reply or an error.

The pet can remember everyday details from conversation across app restarts. Review or remove them under **Connection… → Memories**. Two desktop pets can visit a shared Lobby on the same local network.

## Run the demo on your Mac

If you already have **Nest Pet.app**, double-click it in Finder. You can move it to Applications or drag its red panda icon onto the app side of the Dock to open it again with one click. After opening, look near the lower-right corner of the desktop. Use **◉ → Bring back** if the pet is out of view, and **◉ → Quit** to close the app.

### Build the app from source

1. Sign in to GitHub, [download the current team build ZIP](https://github.com/lemonduck2364/hack-the-nest-study-pet/archive/refs/heads/desktop-pet.zip), and double-click the ZIP to unpack it. Start with a fresh download if you have an older copy.
2. Install [Node.js 24 LTS for macOS](https://nodejs.org/en/download) if you don't already have Node.js 22.12 or later. Open a fresh Terminal window afterward.
3. Type `cd` followed by a space. Drag the **desktop** folder from the unzipped project into Terminal and press **Return**.
4. Paste this line into Terminal and press **Return**. The first build needs internet to download Electron.

```sh
npm ci && npm run smoke && npm run build:mac
```

When the command finishes, open **desktop → dist → Nest Pet.app** in Finder, or double-click **Open Desktop Pet.command** at the top of the downloaded project. The Mac app has a red panda icon and includes Electron. After the first build, launch it from Finder or the Dock. This is a local team build. Public distribution needs Developer ID signing and notarization.

## Let the pet talk

Play, naps and cursor interactions work without an AI key. To try a live response:

1. Sign in to [Google AI Studio](https://aistudio.google.com/api-keys). Use **Create API key** if you don't already have a key, then copy it. [Google's setup guide](https://ai.google.dev/gemini-api/docs/api-key) covers project setup if asked.
2. On the Mac, select **◉ → Connection…**. Paste your key in the password field and click **Save key**. The app saves it encrypted on this Mac. Open Connection again if you need to replace or remove it.
3. Choose **◉ → Chat**, type a short line such as “I'm taking a little break,” and press **Return**. The response shows up in the pet's speech bubble.

Set the key before recording. Keep it out of GitHub, screenshots and messages. Chat sends the typed message, recent conversation context, and saved memory excerpts to Gemini.

## Test the latest chat update

1. Send four short messages in a row, waiting for each reply before sending the next. The spinner should appear after each send and clear when a reply or error arrives.
2. Open Chat, leave it empty, and move the pointer away for about five seconds. The input should fade out.
3. Choose **◉ → Quit**, start the pet again, and send another message. The saved key should carry over.

If chat gets stuck, open **◉ → Connection…** and share the displayed error or HTTP status with Evan. The pet keeps the draft when a reply fails. Press Return or use the retry button to resend it.

## Try the Lobby with two Macs

1. On both Macs, quit any older copy, open the latest **Nest Pet.app**, and connect to the same Wi-Fi or hotspot that allows devices to reach each other. If you want two distinct characters, choose **Dafeiyu** on one Mac.
2. On the first Mac choose **◉ → Visit Lobby → Host Room**. Copy the invite code and pass it to the second Mac.
3. On the second Mac choose **◉ → Visit Lobby**, paste the code, and click **Join**. If macOS asks for local network access, allow it for Nest Pet. Both screens show the two pets and the same little greeting.
4. On the guest Mac, click **Go Home** to bring its pet back. On the host Mac, **Go Home** closes the room and returns both pets to their desktops. Each Mac keeps its own chat memories.

The greeting is scripted, so it works without a Gemini key. The room is hosted on the first Mac, and its invite works only while that room is open and reachable on the local network.

If **Join** says it cannot connect, keep the host room open and copy a fresh invite after any Wi-Fi change. On both Macs, check **System Settings → Privacy & Security → Local Network** and confirm Nest Pet is allowed if it appears there. Some venue and guest networks block devices from reaching each other even on the same Wi-Fi. Switch both Macs to a network or hotspot that allows device-to-device connections, then host a new room and copy its new invite.

## Rehearse the demo

Show the pet noticing your cursor, then have it recall a saved preference. Open the Lobby on two Macs, show both pets greeting, and return to the desktop. Record a backup of the flow in case venue networking is slow.

The included character art is temporary and for private, noncommercial team testing. See the [asset credits](desktop/THIRD_PARTY_NOTICES.md).

## If you get stuck

| What you see | What to try |
| --- | --- |
| GitHub shows 404 | Check that you're signed in and have access to the private repo. |
| The pet is running but you can't see it | Return to a regular desktop and choose **◉ → Bring back**. |
| The pet moves but chat doesn't reply | Check the internet connection and the key in **◉ → Connection…**. You can continue rehearsing with the pet's local interactions. |

The active app is in [`desktop/`](desktop/). The team's previous browser prototype and its original instructions are preserved in [`archive/original-web-prototype/`](archive/original-web-prototype/README.md).


### Appearance preview

Red panda is the default for new installations. She reads, takes tea breaks, sits quietly, and curls up for sleep. Move the cursor nearby when she's awake to see her switch to a standing attention pose. Choose **Dafeiyu** or **Pixel panda** from the pet menu to switch appearances. Pixel panda has frame-by-frame transitions for its puzzle cube, kitten, laptop and nap, with eyes that can track the cursor during an action. See [the desktop guide](desktop/README.md) for the supported activities.
