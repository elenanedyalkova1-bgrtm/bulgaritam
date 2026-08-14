/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    admin: { authenticated: boolean; csrf: string };
  }
}
