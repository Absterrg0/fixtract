'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EU_COUNTRIES, type Country } from '@/lib/countries'
import { cn } from '@/lib/utils'

interface PhoneCountryCodeSelectProps {
  value: string
  onValueChange: (dialCode: string) => void
  disabled?: boolean
  className?: string
}

function matchesQuery(country: Country, query: string): boolean {
  return (
    country.name.toLowerCase().includes(query) ||
    country.code.toLowerCase().includes(query) ||
    country.dialCode.toLowerCase().includes(query)
  )
}

export function PhoneCountryCodeSelect({
  value,
  onValueChange,
  disabled,
  className,
}: PhoneCountryCodeSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = useMemo(
    () => EU_COUNTRIES.find((country) => country.dialCode === value),
    [value],
  )

  const query = search.trim().toLowerCase()
  const filtered = useMemo(
    () => (query ? EU_COUNTRIES.filter((country) => matchesQuery(country, query)) : EU_COUNTRIES),
    [query],
  )

  const selectCountry = (dialCode: string) => {
    onValueChange(dialCode)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'border-input flex h-9 w-[140px] shrink-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open && 'border-ring ring-ring/50 ring-[3px]',
            className,
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Phone country code"
        >
          <span className="truncate">
            {selected ? `${selected.flag} ${selected.dialCode}` : value}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 opacity-50 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[280px] p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') event.preventDefault()
              }}
              placeholder="Search country..."
              className="h-8 border-0 bg-muted/50 pl-7 text-sm shadow-none focus-visible:ring-0"
              aria-label="Search country code"
              autoFocus
            />
          </div>
        </div>

        <div
          role="listbox"
          aria-label="Phone country codes"
          className="max-h-60 overflow-y-auto p-1"
        >
          {filtered.map((country) => {
            const isSelected = country.dialCode === value
            return (
              <button
                key={country.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectCountry(country.dialCode)}
                className="hover:bg-muted focus-visible:bg-muted flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none"
              >
                <span className="w-6 shrink-0 text-base leading-none">{country.flag}</span>
                <span className="min-w-0 flex-1 truncate">{country.name}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">{country.dialCode}</span>
                {isSelected ? <Check className="size-3.5 shrink-0" /> : null}
              </button>
            )
          })}

          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-sm">No countries found</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
