# Your Daily Local Mobile App
## Project Decisions

This document records significant architectural and product decisions made during development.

Its purpose is to document **why** decisions were made so they are not revisited without good reason.

---

# June 2026

## Beta First Strategy

Decision

The primary goal is to complete and launch a stable beta before beginning additional major feature work.

Reason

A smaller, polished application provides more value than a larger application with unfinished features.

Status

Permanent until beta concludes.

---

## Analytics Deferred Until After Beta

Decision

The analytics platform will not be developed until beta testing has concluded.

Deferred Features

- WordPress Analytics Dashboard
- Sponsor Reporting
- Reader Engagement Metrics
- Firebase Analytics
- Crashlytics

Reason

Analytics do not improve the beta user experience.

Priority is stability.

---

## WordPress Is The Single Source Of Truth

Decision

The app displays content directly from WordPress.

Reason

Editors should never have to publish stories twice.

Maintaining a single editorial workflow reduces mistakes and simplifies publishing.

---

## Top Story Uses A WordPress Tag

Decision

The Home screen Top Story is selected using a dedicated WordPress tag.

Sticky posts are not used.

Reason

Sticky posts affect website behavior.

A dedicated tag allows editors to feature a story in the app without changing the website layout.

---

## Relative Timestamps

Decision

Feeds display relative timestamps.

Examples

- Just now
- 12 min ago
- Today • 3:45 p.m.
- Yesterday • 8:15 a.m.

Reason

Readers understand content freshness more quickly.

The Article screen still displays the publication date in a readable format.

---

## Notification Preferences

Decision

Users choose which categories generate push notifications.

Categories

- Breaking News
- Public Safety
- Weather Emergencies
- Live Video

Reason

Readers have different interests.

Reducing unwanted notifications improves long-term engagement.

---

## AsyncStorage

Decision

User preferences and saved stories are stored locally using AsyncStorage.

Reason

No login is required.

Users retain preferences between sessions without requiring an account.

---

## Google Play Strategy

Decision

Release progression follows:

Internal Testing

↓

Closed Testing

↓

Production

Reason

Issues should be discovered by a small group before public release.

---

## Advertising

Decision

The application uses direct sponsorships rather than programmatic advertising.

Current

Image sponsorship placements.

Future

Expanded sponsorship opportunities.

Reason

Direct sponsorship provides predictable revenue while maintaining a clean user experience.

---

## No AdMob

Decision

Google AdMob will not be implemented.

Reason

Local sponsorships align better with the Your Daily Local business model.

---

## Full File Replacements

Decision

During development, complete file replacements are preferred over partial snippets.

Reason

Large React Native files are prone to copy/paste mistakes when only partial sections are replaced.

This significantly reduces build errors.

---

## Mobile First

Decision

The application is optimized for phones.

Tablet support is secondary.

Reason

Nearly all current readership consumes content on phones.

Tablet optimization can occur after beta.

---

## Stability Before Features

Decision

Bug fixes take priority over new functionality.

Reason

A reliable application builds trust with readers.

---

## Offline Behavior

Decision

The application should never display mock content in production.

Reason

Displaying fictional articles can confuse users and reduce credibility.

Future work will replace failed network requests with cached WordPress content.

---

## WordPress Mock Provider

Decision

The mock provider exists only for development.

Production always uses WordPress.

Reason

Development can continue without network access while production always displays live content.

---

## Google Play Assets

Decision

Professional Play Store assets are maintained separately from application source code.

Reason

Marketing materials change independently from application code.

---

## Documentation

Decision

Operational documentation is maintained outside the Git repository.

Technical documentation remains inside the repository.

Inside Repository

README.md

CHANGELOG.md

ARCHITECTURE.md

DECISIONS.md

Outside Repository

Recovery Guide

Play Store Documentation

Firebase Documentation

Release Checklists

Reason

Separates source code from operational procedures.

---

## GitHub

Decision

GitHub remains the source of truth for application code.

Google Drive stores operational documentation and marketing assets.

Reason

Code and documentation have different backup and collaboration requirements.

---

# Future Decisions

New architectural decisions should be recorded here as they occur.

Do not remove previous decisions.

If a decision changes, append a new entry explaining:

- What changed.
- Why it changed.
- When it changed.

This document should preserve the historical reasoning behind the application's evolution.
## iOS Development

Decision

The Your Daily Local app should eventually be released for iOS.

Current Status

Deferred until after the Android beta is stable.

Reason

Android is already in Google Play Internal Testing.

The immediate priority is fixing beta issues, validating the reader experience, and stabilizing the app before adding another platform.

Planned iOS Work

- Apple Developer account setup
- iOS bundle identifier
- Apple Push Notification setup
- Firebase iOS configuration
- iOS app icon review
- iOS splash screen review
- App Store screenshots
- App Store privacy labels
- TestFlight setup
- iOS-specific layout testing
- iPad support decision

Notes

Most of the Expo React Native codebase should carry over to iOS, but notifications, store assets, privacy declarations, and App Store review requirements will need separate setup.