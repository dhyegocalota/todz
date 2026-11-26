# Open source surfaces: test plan

## Unit

- [ ] A GitHub answer with `stargazers_count` 1234 yields 1234, is cached for 3600 seconds and is not fetched again.
- [ ] A network error, a 403, a body with no count, a string count, a negative count, a fractional count and a body that is not JSON each yield no number, cached for 300 seconds.
- [ ] 1234 is written `1.2k`, 1000 `1k`, 999 `999`.
- [ ] The landing holds two pills linking `https://github.com/dhyegocalota/todz`, the hero one after Download for Mac.
- [ ] With no count the pills hold the label and no number.
- [ ] The policy is the same string with and without a count and holds no `unsafe-inline`.
- [ ] The JSON-LD holds `codeRepository` and `license`; llms.txt and llms-full.txt name the repository and `AGPL-3.0`.
- [ ] The README holds the stars badge right after the license badge.
- [ ] `RepositoryAddress.text` equals `REPOSITORY.url`.

## E2E

- [ ] The pill shows `1.2k` in the hero and the footer, in light and dark, and with scripts off.
- [ ] The pill keeps one bounding width before, during and after the count-up.
- [ ] Under reduced motion the count never starts and the final number shows.
- [ ] Against an unreachable GitHub the pill shows the label and no number.
- [ ] A phone has no sideways scroll.

## Walk

- [ ] Screenshots in light and dark at 1280 and 375 under `media/`.
- [ ] The popover footer, the todz menu and Settings each open the repository.

## Coverage honesty

The popover, menu and Settings views are proven by the build and the address pin; the opening itself is not driven in this lane.
