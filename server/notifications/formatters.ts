/**
 * Shared formatting utilities for emails
 */

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  
  export function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
  
  export function formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
    }).format(date);
  }