# Overview (z.ai DevPack — GLM Coding Plan)

## Usage Credit Allowance

Each plan is subject to both a 5-hour usage limit and a weekly usage limit.

| Plan Type | 5-Hour Credits | Weekly Credits |
| :-------: | :------------: | :------------: |
|    Lite   |      2,000     |     10,000     |
|    Pro    |     12,000     |     60,000     |
|    Max    |     28,000     |     140,000    |

**Credit Reset Rules**

* **5-hour credits**: Dynamically refreshed; credit quota resets 5 hours after consumption.
* **Weekly credits**: Activated upon subscription; resets every 7 days.

## Credit Calculation

* Model credit usage = (Input tokens × Input multiplier + Cached Input tokens × Cached Input multiplier + Output tokens × Output multiplier) / 10,000
* MCP tool credit usage = Number of calls × Output multiplier

| Product Type | Product | Input Multiplier | Cached Input Multiplier | Output Multiplier |
|---|---|---|---|---|
| Model | GLM-5.3 | 6.9 | 1.7 | 24 |
| Model | GLM-5.3-Flash (Including MCP for visual understanding) | 2.3 | 0.56 | 8 |

**During off-peak hours, model usage is charged at 50% of the standard credit rate**.

**Peak hours**: Monday to Friday, 14:00–18:00 Singapore Standard Time (UTC+8).

## Estimated Token Allowance

Token usage varies depending on the cache hit rate, as shown below:

| Cache Hit Rate | Model | Lite (M Tokens/week) | Pro (M Tokens/week) | Max (M Tokens/week) |
| :------------: | :---: | :------------------: | :-----------------: | :-----------------: |
| 95% | GLM-5.3 | 48–97 | 290–580 | 676–1,352 |
| 95% | GLM-5.3-Flash | 146–292 | 877–1,755 | 2,047–4,095 |