TEENVERSE V2 — PART 1 CORE SERVER
=================================

This package upgrades the core server with:
- Public room messages saved in MongoDB
- Last 100 room messages loaded on entry
- Room messages automatically removed after 24 hours
- Permanent private messages, including messages to offline users
- Private-message history loading
- Conversation previews
- Multiple browser tabs/devices handled more safely
- Health endpoint at /api/health

IMPORTANT
---------
This uploaded project contained only the core server files. It did not contain
public/chat.html, public/js/chat.js, CSS, or the other frontend files.

So this ZIP is a complete upgraded CORE SERVER, not yet the full deployable site.
Keep your existing public folder and copy it into this project before running.

INSTALL
-------
1. Back up your current TeenVerse folder.
2. Extract this ZIP.
3. Copy your existing public folder into the extracted project root.
4. Create .env from .env.example and add your real values privately.
5. In the project terminal run:

   npm install
   npm start

FRONTEND EVENTS REQUIRED
------------------------
Your public/js/chat.js should handle:
- room history
- private history
- private message sent
- dm conversations
- chat error

Never upload your real .env publicly or commit it to GitHub.
