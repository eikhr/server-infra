"""Healthcheck for garmin-mcp that also keeps its Garmin login alive.

The server only refreshes its Garmin token when a tool is called, so a few
idle weeks let the refresh token expire and every call 401s from then on. This
makes a real tool call through the running server, so the refresh (and the
token file rewrite) happens in the process that holds the tokens. A separate
refresh would rotate the token out from under it.

Exits non-zero when the call fails, which marks the container unhealthy.
"""

import asyncio
import datetime
import sys

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

URL = "http://127.0.0.1:8000/mcp"


async def main() -> int:
    async with streamablehttp_client(URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(
                "get_stats", {"date": datetime.date.today().isoformat()}
            )
    text = " ".join(getattr(c, "text", "") for c in result.content)
    # The server reports Garmin failures as a normal result, not isError.
    if result.isError or text.startswith("Error"):
        print(text[:300], file=sys.stderr)
        return 1
    return 0


sys.exit(asyncio.run(main()))
