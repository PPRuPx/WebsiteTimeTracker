# Privacy Policy

## What We Don't Do
- We **never** collect your personal data
- We **don't** see or store your browsing history
- We **don't** track what you do on websites
- We **don't** send any data to external servers
- We **don't** use analytics or tracking cookies

## What We Do
1. We check website addresses **only** to get:
    - Domain names (like "youtube.com")
    - Time spent on each domain

2. We store locally in your browser:
    - Total time per website
    - Website icons (favicons)
    - List of blocked websites (if you choose to block any)
    - Language preference (English or Russian)
    - Display settings (sites per page, view mode)

3. All data stays **only in your browser** and gets deleted if you:
    - Reset the extension data
    - Remove the extension
    - Clear browser data

## New Features and Data Handling

### Site Blocking
- When you block a website, we store only the domain name in your browser
- Blocked sites are redirected to a local extension page
- No information about blocked sites is transmitted anywhere
- You can unblock sites at any time, which removes them from the blocked list

### Localization
- Language preference is stored locally in your browser
- No language data is sent to external services
- Supported languages: English and Russian

### Enhanced Tracking
- We track which website is currently active
- Time is only counted when your browser window is focused
- Progress bars show relative time comparison between sites
- All calculations happen locally in your browser

## Why We Need Permissions

| Permission | Why We Need It |
|------------|---------------|
| `storage` | To save your time stats, blocked sites, and preferences |
| `tabs` | To see which website is active and track time |
| `webRequest` | To intercept and redirect blocked websites |
| `declarativeNetRequest` | To implement website blocking rules |
| `<all_urls>` | To work on all websites and block specific domains |

## Data Security

- **Local Storage Only**: All data is stored in Chrome's local storage
- **No Network Transmission**: We never send your data over the internet
- **Extension Isolation**: Data is only accessible within the extension
- **Automatic Cleanup**: Data is removed when you uninstall the extension

## What Happens When You Block a Site

1. The domain name is added to your local blocked list
2. Extension creates a local redirect rule
3. When you visit the blocked site, you see a local extension page
4. The page shows your time statistics for that site
5. You can unblock the site, which removes the redirect rule

## Language and Settings

- Language preference is stored in `localStorage`
- Display settings (sites per page, view mode) are saved locally
- These preferences help customize your experience
- All settings can be reset or changed at any time

## Third-Party Services

- **Google Favicon Service**: We fetch website icons from Google's favicon service
- **No Other Services**: We don't use any other external services or APIs

## Updates and Changes

- This privacy policy may be updated as the extension evolves
- All changes will maintain the same level of privacy protection
- Your data remains local and private regardless of updates

## Contact

If you have questions about privacy or data handling: [pprupx@outlook.com](mailto:pprupx@outlook.com)

---

**Last Updated**: December 2024  
**Version**: 1.1
