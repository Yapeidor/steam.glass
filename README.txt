STEAMGLASS — CLASSIC LINUX EDITION
=================================

This build uses a classic GNOME 2 / GTK 2-inspired desktop look.
The frontend is split into separate HTML, CSS and JavaScript files.
A small Node.js server provides live host status and system information.

PROJECT LAYOUT
--------------
server.js                 Node.js web server and JSON API
package.json              Start command
public/index.html         Main page
public/assets/style.css   Desktop and window styling
public/assets/app.js      UI interactions and API calls
public/assets/            Logos and other images

RUN ON YOUR VPS
---------------
1. Install Node.js 18 or newer.
2. Upload this folder to your VPS.
3. Open a terminal in this folder.
4. Run:

   npm start

The server listens on port 3000 by default.
Open http://YOUR_SERVER_IP:3000 to check the page.

OPTIONAL PORT CONFIGURATION
---------------------------
You can change the listening port with:

   PORT=8080 npm start

The server binds to 0.0.0.0 by default, so it can be reached from outside
when the VPS firewall allows the selected port.

API ENDPOINTS
-------------
GET /api/health  Basic server health and uptime.
GET /api/system  Runtime version, platform, memory and load average.

PRODUCTION NOTE
---------------
For a public domain, put Nginx or another reverse proxy in front of this
Node.js server and enable HTTPS. Do not expose an administrative port unless
you specifically need it. This project currently has no login system,
content database or user accounts; the API is a read-only host monitor.
