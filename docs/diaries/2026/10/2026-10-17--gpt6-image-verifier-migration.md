# Task: Migrate Numberblock image verification

**Date:** 2026-10-17  
**Status:** completed

## Narrative

Move the OpenAI vision verification request to GPT-6 Luna and set high reasoning effort.

## Approach

Updated the shared verifier model to `gpt-6-luna` and its Chat Completions payload to `reasoning_effort: high` with an 8,000-token completion limit. The image-generation model remains unchanged.

## Evidence & Verification

`deno check` passed for the verifier's Edge Function entrypoint. An offline mocked fetch confirmed the request model and parameters and confirmed the existing JSON verification response is still parsed.

## Handoff Notes

No Supabase function deployment was performed. Changelog entry waits for release per workspace rules.
