# Nest Pet

Nest Pet is a little companion that lives on your Mac desktop. It plays and naps on its own, notices your cursor, and can talk to you through its own speech bubble.

This team build has ten activities, cursor attention, and an optional Gemini-powered chat. The latest update remembers your Gemini key on this Mac, shows a spinner while a reply is on its way, and keeps the input ready for another message after a reply or an error.

The pet can remember everyday details from conversation across app restarts. Review or remove them under **Connection… → Memories**. Two desktop pets can visit a shared Lobby on the same local network.

## Run the demo on your Mac

If you received **Nest Pet.app**, double-click it in Finder. You can move it to Applications or drag it to the Dock to keep it handy. After opening, look near the lower-right corner of the desktop. Use **◉ → Bring back** if the pet is out of view, and **◉ → Quit** to close the app.

### Build the app from source

On a Mac with Node.js 22.12 or later, open Terminal in the repo’s **desktop** folder and run:

```sh
npm ci
npm run smoke
npm run build:mac
```

Double-click **desktop/dist/Nest Pet.app**. The first build uses the Electron version pinned by the project. The resulting app includes Electron and opens on its own. This is a local team build. Public distribution needs Developer ID signing and notarization.

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

1. On both Macs, open **Nest Pet.app** and connect to the same Wi-Fi. Use the same branch/build on both. If you want two distinct characters, choose **Dafeiyu** on one Mac.
2. On the first Mac choose **◉ → Visit Lobby → Host Room**. Copy the invite code and pass it to the second Mac.
3. On the second Mac choose **◉ → Visit Lobby**, paste the code, and click **Join**. If macOS asks for local network access, allow it for Nest Pet. Both screens show the two pets and the same little greeting.
4. On the guest Mac, click **Go Home** to bring its pet back. On the host Mac, **Go Home** closes the room and returns both pets to their desktops. Each Mac keeps its own chat memories.

The greeting is scripted so you can show it without a Gemini key. If venue Wi-Fi blocks device-to-device connections, try putting both Macs on the same personal hotspot.

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

Red panda is the default for new installations. She reads, takes tea breaks, sits quietly, and curls up for sleep. Move the cursor nearby when she's awake to see her switch to a standing attention pose. Choose **Dafeiyu** from the pet menu to switch appearances. See [the desktop guide](desktop/README.md) for the supported activities.
