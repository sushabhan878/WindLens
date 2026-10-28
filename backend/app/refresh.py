import asyncio
from .source import fetch_snapshot, write_snapshot


async def main():
    snapshot = await fetch_snapshot()
    write_snapshot(snapshot)
    print(f"Saved real Elexon data: {len(snapshot['actuals'])} actuals, {len(snapshot['forecasts'])} forecast versions; retrieved {snapshot['retrieved_at']}")


if __name__ == "__main__":
    asyncio.run(main())
