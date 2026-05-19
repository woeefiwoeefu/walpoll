# WalPoll

Real-time polling platform on Walrus. Create polls, vote, see results with live charts. All votes stored as Walrus blobs, verifiable and permanent.

## Features

- Single choice + ranked choice polls
- Real-time donut chart + bar chart visualization
- Countdown timer per poll
- QR code sharing
- Seal encryption for private polls
- All votes stored on Walrus blobs with blob ID
- CSV export

## Stack

- React + Vite + Recharts
- Walrus blob storage (testnet)
- Seal encryption (AES-256-GCM)
- Sora + DM Serif Text typography

## Run

```
npm install
npm run dev
```

## Deploy

```
npm run build
npx vercel
```

## License

MIT
