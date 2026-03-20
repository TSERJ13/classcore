# Vercel & GitHub Deployment Guide

Follow these steps to set up a professional CI/CD pipeline for ClassCore, with separate Development and Production environments.

## 1. GitHub Repository Setup

1.  **Create a New Repository** on GitHub (e.g., `classcore-production`).
2.  **Push your code**:
    ```bash
    git init
    git add .
    git commit -m "Initial production-ready commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
    git push -u origin main
    ```
3.  **Create a Development Branch**:
    - Go to GitHub -> Settings -> Branches.
    - Create a new branch named `develop` from `main`.

## 2. Vercel Project Setup

1.  Import your GitHub repository into Vercel.
2.  **Production Environment**:
    - Vercel will automatically detect `main` as the Production branch.
    - Any push to `main` will update your live site.
3.  **Development Environment**:
    - In Vercel Project Settings -> Git:
    - Add `develop` as a "Preview" or "Development" branch.
    - Now, any push to `develop` will update your **Dev URL** (e.g., `classcore-dev.vercel.app`).

## 3. Environment Variables

You MUST add these in Vercel (Settings -> Environment Variables) for both environments:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key |

> [!TIP]
> Use a separate Supabase Project for "Dev" and "Production" if you want to keep test data completely isolated!

## 4. Workflow (How to Change Things)

1.  **Work on Dev**: Make changes in your local `develop` branch.
2.  **Push to Dev**: `git push origin develop`.
3.  **Verify**: Check your Vercel Dev URL.
4.  **Go Live**: When ready, create a **Pull Request** on GitHub to merge `develop` into `main`.
5.  **Vercel Production**: Once merged, Vercel will build and deploy to your live domain automatically.

## 5. Data Cleanup (Going Live)

Before you launch:
1.  **Supabase**: Go to your Supabase SQL Editor and run:
    ```sql
    TRUNCATE TABLE studio_settings;
    ```
    This wipes all test studios/staff.
2.  **Local App**: Clear your browser cache/cookies to start as a fresh user.
