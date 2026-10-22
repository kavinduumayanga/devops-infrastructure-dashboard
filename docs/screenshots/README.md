# Screenshot capture guide

No verified dashboard screenshots are currently stored in this directory. Do
not add generated mockups or images that imply the seven VMs were running when
they were not.

Capture the following views manually after deploying and validating the real
lab through Nginx.

| Filename | Required view | What it should demonstrate |
|---|---|---|
| `overview-topology.png` | Overview page at desktop width | All seven VM nodes, readable connectors, status summary, and an unclipped current-responder badge |
| `node-details.png` | Overview with a monitored node selected | Monitoring method, health, latency/latest success when available, supported service details, and relationships |
| `round-robin.png` | Application Servers or request activity view | Real observed requests served by both `app01` and `app02` |
| `cache-aside.png` | Cache page after controlled requests | Real `MISS`/population followed by `HIT`, or an honestly labeled unavailable state |
| `responsive-topology.png` | Narrow tablet/mobile viewport | Responsive topology behavior without clipped node content |

## Capture checklist

1. Verify the lab using [`../validation.md`](../validation.md).
2. Open `http://192.168.56.20/devops-dashboard/`, not a design mockup.
3. Capture only current application output.
4. Redact any visible credentials, authorization headers, shell history,
   personal bookmarks, unrelated tabs, usernames, or host paths.
5. Keep the private lab IPs if they are intentionally part of the architecture;
   verify that no public address or secret is also visible.
6. Use a consistent browser size and theme for the main set.
7. Crop to the application content while preserving enough context to make the
   view credible.
8. Optimize image size without making status text unreadable.
9. Review the committed image directly on GitHub before adding it to the root
   README.

## Adding verified images to the README

After a file exists, add a Markdown image using descriptive alt text and its
repository-relative path—for example, the alt text “Seven-VM infrastructure
topology” with the path `docs/screenshots/overview-topology.png`.

Do not add an image reference before the corresponding file is committed; that
would create a broken GitHub README.

## Accessibility

- Write alt text that describes the purpose of the image, not merely
  “screenshot.”
- Keep explanations and validation commands in text; screenshots must not be
  the only source of technical information.
- Avoid relying on status color alone in captions.

[Back to project README](../../README.md)
