# ADDITIVE FILE - Policy 986 AED - does NOT overrule existing site files.
# Author: Johan Wilhelm van Antwerp | Ionity (Pty) Ltd | AEDI | Updated: 2026-07-12 SAST
# (c) 2018-2026 Antwerp Designs | Ionity (Pty) Ltd - All Rights Reserved - TM2

DEPLOYMENT MAP - all files are ADDITIVE; nothing replaces what is live today.

1. llms.txt                 -> upload to site root: /llms.txt   (currently EMPTY on the live
                               site although robots.txt already references it - this fills it)
2. humans.txt               -> upload to site root: /humans.txt (same - referenced but empty)
3. robots.additions.txt     -> APPEND its block to the END of the existing /robots.txt.
                               Do NOT replace the file; current rules stay authoritative.
4. sitemap-ionity-2026.xml  -> upload to site root as a SECOND sitemap next to /sitemap.xml,
                               then keep the extra "Sitemap:" line from robots.additions.txt.
                               Also submit in Google Search Console + Bing Webmaster Tools.
5. jsonld-head-snippet.html -> copy the <script> block into the <head> of every page.
                               Coexists with the existing DC / Open Graph / Twitter meta.
6. security.txt             -> upload to /.well-known/security.txt
7. 622fd5e537fe7d53698c05fe810d8685.txt                   -> IndexNow key file: upload to site root, keep filename exactly.
                               Then ping: https://api.indexnow.org/indexnow?url=https://www.ionity.today/&key=622fd5e537fe7d53698c05fe810d8685

NOTE: live Twitter meta uses @AntwerpDesigns / @iAntwerpDesigns while the link registry
records x.com/JohanAntwerp - kept registry value in JSON-LD Person; confirm which X handle
is canonical for the Organization before adding it to sameAs.
