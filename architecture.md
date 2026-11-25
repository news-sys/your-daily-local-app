# Your Daily Local Mobile App
## Architecture Guide

---

# Project Overview

The Your Daily Local mobile app is an Expo React Native application that delivers local news, breaking news, sports, live video, and community information from Your Daily Local.

The app is designed around a live WordPress backend while maintaining a native mobile experience.

Current Status:

- Google Play Internal Testing
- Android
- Expo React Native
- TypeScript

---

# Core Principles

The application follows these design principles.

1. WordPress is the single source of truth.

2. The mobile app should require minimal editorial effort beyond maintaining the website.

3. Performance and reliability take priority over adding features.

4. User experience should remain simple and intuitive.

5. Major feature work pauses during beta in favor of stability.

---

# Technology Stack

Framework

- Expo
- React Native
- Expo Router

Language

- TypeScript

Backend

- WordPress REST API

Notifications

- Firebase Cloud Messaging

Storage

- AsyncStorage

Deployment

- Expo EAS Build

Distribution

- Google Play Console

---

# Folder Structure

app/

Contains all application screens.

Current tabs:

- Home
- Breaking
- News
- Sports
- Watch
- Search
- Saved
- Settings
- Article

---

components/

Reusable UI components.

Examples:

- PostFeed
- RotatingAdSlot
- Notification components

---

services/

Application business logic.

Examples:

- WordPress provider
- Saved Stories
- Notification Preferences
- Analytics
- API wrapper

---

providers/

Contains data providers.

Current:

WordPress Provider

Development:

Mock Provider

---

types/

Shared TypeScript models.

---

utils/

Reusable helper functions.

Examples:

- formatDisplayDate()

---

assets/

Images

Icons

Branding

Advertisements

---

# Navigation

Bottom Tabs

Home

Breaking

News

Sports

Watch

Search

Saved

Settings

Articles open from any screen using Expo Router.

---

# Data Flow

WordPress

↓

WordPress REST API

↓

services/api.ts

↓

Provider

↓

React Components

↓

User Interface

WordPress is considered the authoritative source for content.

---

# Home Screen

The Home screen is intentionally different from every other feed.

Sections:

Top Story

Latest News

Sports

Forest County News

Advertisements

Top Story is controlled using a dedicated WordPress tag.

Sticky posts are NOT used.

This allows editors to promote any article without affecting website behavior.

---

# News Feeds

Breaking

Latest News

Sports

Forest County News

Watch

Each feed loads independently from WordPress.

Pagination is supported.

Pull-to-refresh is supported.

---

# Articles

Article screen displays

- Featured image

- Headline

- Publication date

- Body

- Related stories

Advertisements are inserted throughout the article.

---

# Search

Search queries WordPress.

Results are displayed using the shared PostFeed component.

---

# Saved Stories

Saved Stories are stored locally.

Storage:

AsyncStorage

Saved stories remain available after app restart.

---

# Notifications

Implemented

- Breaking News

- Public Safety

- Weather Emergencies

- Live Video

Preferences are stored locally using AsyncStorage.

Push notifications use Firebase Cloud Messaging.

---

# Settings

Current options

Notification Preferences

Privacy Policy

Contact Us

Send Feedback

Version Information

---

# Advertising

Current implementation

Rotating sponsorship framework.

Ads are image-based.

Placements

Home

Article

Feed

No Google AdMob.

No programmatic advertising.

---

# WordPress Integration

Current integration

Home

Categories

Search

Articles

Watch

Top Story Tag

The app intentionally mirrors website content.

Editors should not need separate workflows.

---

# Offline Behavior

Current

Previously loaded stories remain available when possible.

Future improvements

Offline caching

Cached article reading

Automatic background refresh

---

# Analytics

Current

Basic event tracking.

Deferred until after beta

Full analytics platform

Sponsor reporting

WordPress analytics dashboard

Reader engagement metrics

Firebase Analytics

Crashlytics

---

# Build Process

Type Check

npx tsc --noEmit

Verify Production Bundle

npx expo export --clear --platform android

Production Build

eas build --platform android --profile production

---

# Release Process

1. Update CHANGELOG

2. Run TypeScript

3. Verify bundle

4. Build .aab

5. Upload to Google Play

6. Internal Testing

7. Verify installation

8. Collect beta feedback

---

# Project Decisions

These decisions are intentional.

Use full file replacements when modifying code.

Top Story uses a WordPress tag.

Relative timestamps throughout the application.

WordPress is the production data source.

Analytics work begins AFTER beta.

User experience takes priority over adding features.

---

# Future Roadmap

Post Beta

Offline caching

Analytics platform

Sponsor reporting

Crash reporting

Performance improvements

Tablet optimization

iOS version
## iOS Roadmap

The app is built with Expo React Native, so the core application code is intended to support both Android and iOS.

iOS-specific work remains deferred until after the Android beta is stable.

Expected iOS requirements:

- Apple Developer enrollment
- iOS bundle identifier
- Firebase iOS app setup
- Apple Push Notification configuration
- TestFlight beta testing
- App Store listing
- App Store privacy questionnaire
- iPhone screenshots
- iPad screenshots if iPad support remains enabled

---

# Related Documentation

README.md

Project overview.

CHANGELOG.md

Release history.

Recovery Guide

Disaster recovery.

Release Checklist

Publishing workflow.

Google Play Documentation

Play Console configuration.

Firebase Setup

Notification configuration.

Architecture.md

System design and development philosophy.
