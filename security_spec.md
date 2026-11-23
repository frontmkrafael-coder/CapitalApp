# Capitalyx Security Specification (Payload-First TDD)

## 1. Data Invariants
1. **Strict User Ownership & PII Isolation**: `/users/{userId}` and all subcollections (`transactions`, `goals`, `recurring`, `companies`, `stats`) contain private PII, CNPJ, salary, and financial records. Only the authenticated owner (`request.auth.uid == userId`) can read or write them. Cross-user access is strictly denied.
2. **Master Gate Integrity**: Subcollection documents (`transactions`, `goals`, `recurring`, `companies`, `stats`) can only be created or updated when the parent `/users/{userId}` document exists.
3. **Immutable Identity & Creation Timestamps**: `uid`, `userId`, `id`, and `createdAt` cannot be modified after creation. All server timestamps (`createdAt`, `updatedAt`, `lastLogin`, `lastAnalysisDate`) must equal `request.time`.
4. **Strict Schema & Volumetric Bounds**: No shadow/undeclared keys are accepted; all strings enforce `.size()` limits matching `firebase-blueprint.json`; monetary amounts must be finite numbers within safe bounds (`> 0` for transaction/recurring amounts, goal targets, baseSalary, and dailyRate; `>= 0` for `currentAmount`). Day numbers (`dayOfMonth`, `paymentDay`, `advanceDay`) must be numbers in `[1, 31]`.
5. **Terminal State Locking on Goals**: Once a goal reaches `isCompleted == true`, subsequent updates are blocked (only deletion is permitted).
6. **Employment Mode Consistency on Companies**: `fixed` companies require valid `baseSalary > 0` and `paymentDay` (1..31), while `freelancer` companies require valid `dailyRate > 0`.
7. **Path ID Hardening**: Single-document operations validate `isValidId(...)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars) on path variables.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-User Profile Read**: User B (`uid_B`) attempts `get(/users/uid_A)`.
2. **Shadow Field Injection on Profile**: User A creates `/users/uid_A` with undeclared key `isAdmin: true`.
3. **UID Spoofing on Transaction Create**: User A creates `/users/uid_A/transactions/tx1` with `userId: "uid_B"`.
4. **Client Timestamp Forgery**: User A creates transaction with `createdAt: 1700000000000` instead of `request.time`.
5. **Negative Transaction Amount**: User A creates transaction with `amount: -500`.
6. **Oversized Description (Denial of Wallet)**: User A creates transaction with 500-char `description` (limit 200).
7. **Invalid Date Format**: User A creates transaction with `date: "22/11/2026"` instead of `YYYY-MM-DD`.
8. **ID Poisoning**: User A attempts to create `/users/uid_A/transactions/bad..id$1` or mismatched `data.id != transactionId`.
9. **Immutable Field Mutation**: User A updates `/users/uid_A` attempting to overwrite `createdAt` or `uid`.
10. **Terminal Goal Re-mutation**: User A attempts to update `currentAmount` on a goal where `existing().isCompleted == true`.
11. **Invalid Recurring Day / Shadow Key**: User A creates `/users/uid_A/recurring/rec1` with `dayOfMonth: 45` or undeclared field `overrideUser: true`.
12. **Freelancer Salary Injection / Cross-User Company List**: User A creates `freelancer` company with missing `dailyRate` or User B attempts `list(/users/uid_A/companies)`.
