export const WIZARD_STEP_TITLES: Record<number, string> = {
  1: "Basic Info",
  2: "Subprojects & Pricing",
  3: "Extra Options",
  4: "FAQ",
  5: "RFQ Questions",
  6: "Post-Booking Questions",
  7: "Custom Message",
  8: "Review & Submit",
}

export type WizardStepError = {
  step: number
  stepTitle: string
  messages: string[]
}

type SubprojectSnapshot = {
  name?: string
  description?: string
  pricing?: {
    type?: "fixed" | "unit" | "rfq" | string
    amount?: number
    priceRange?: { min?: number; max?: number }
  }
  errors?: { priceRange?: string; executionDurationRange?: string }
  included?: Array<{ name?: string }>
  materialsIncluded?: boolean
  materials?: Array<{ name?: string }>
  preparationDuration?: { value?: number }
  executionDuration?: {
    value?: number
    range?: { min?: number; max?: number }
  }
}

export type WizardProjectSnapshot = {
  category?: string
  service?: string
  title?: string
  description?: string
  priceModel?: string
  distance?: { address?: string; maxKmRange?: number }
  resources?: string[]
  intakeMeeting?: { resources?: string[] }
  customerPresence?: string
  subprojects?: SubprojectSnapshot[]
  extraOptions?: Array<{ name?: string; price?: number }>
  termsConditions?: Array<{ name?: string; description?: string }>
  faq?: Array<{ question?: string; answer?: string }>
  rfqQuestions?: Array<{ question?: string; type?: string; options?: string[] }>
  postBookingQuestions?: Array<{ question?: string; type?: string; options?: string[] }>
}

function packageLabel(sub: SubprojectSnapshot, index: number): string {
  return sub.name?.trim() || `Package ${index + 1}`
}

export function collectSubprojectErrors(sub: SubprojectSnapshot, index: number): string[] {
  const label = packageLabel(sub, index)
  const errors: string[] = []

  if (!sub.name?.trim()) errors.push(`${label}: package name is required`)
  if (!sub.description?.trim()) {
    errors.push(`${label}: package scope is required`)
  } else if (sub.description.trim().length < 10) {
    errors.push(`${label}: package scope must be at least 10 characters`)
  }

  if (!sub.pricing?.type) {
    errors.push(`${label}: pricing type is required`)
  } else if (sub.pricing.type === "rfq") {
    const { min, max } = sub.pricing.priceRange || {}
    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`${label}: RFQ price range minimum cannot be above maximum`)
    }
    const range = sub.executionDuration?.range
    const hasMin = typeof range?.min === "number" && Number.isFinite(range.min)
    const hasMax = typeof range?.max === "number" && Number.isFinite(range.max)
    if (!hasMin && !hasMax) {
      errors.push(`${label}: execution duration range is required for RFQ packages`)
    } else {
      if (hasMin && range!.min! <= 0) errors.push(`${label}: execution duration minimum must be greater than 0`)
      if (hasMax && range!.max! <= 0) errors.push(`${label}: execution duration maximum must be greater than 0`)
      if (hasMin && hasMax && range!.min! > range!.max!) {
        errors.push(`${label}: execution duration minimum cannot be above maximum`)
      }
    }
  } else {
    if (sub.pricing.amount == null || sub.pricing.amount <= 0) {
      errors.push(`${label}: a price greater than 0 is required`)
    }
    if (!sub.executionDuration?.value || sub.executionDuration.value <= 0) {
      errors.push(`${label}: execution duration is required`)
    }
  }

  const namedIncluded = (sub.included || []).filter((item) => item.name?.trim())
  if (namedIncluded.length < 3) {
    errors.push(`${label}: at least 3 included items with names are required`)
  }
  if ((sub.included || []).some((item) => !item.name?.trim())) {
    errors.push(`${label}: every included item needs a name`)
  }

  if (typeof sub.materialsIncluded !== "boolean") {
    errors.push(`${label}: say whether materials are included`)
  } else if (sub.materialsIncluded) {
    const namedMaterials = (sub.materials || []).filter((item) => item.name?.trim())
    if (namedMaterials.length === 0) {
      errors.push(`${label}: add at least one material when materials are included`)
    }
  }

  if (typeof sub.preparationDuration?.value !== "number") {
    errors.push(`${label}: preparation duration is required`)
  }

  if (sub.errors?.priceRange) errors.push(`${label}: ${sub.errors.priceRange}`)
  if (sub.errors?.executionDurationRange) errors.push(`${label}: ${sub.errors.executionDurationRange}`)

  return errors
}

export function collectStepErrors(step: number, data: WizardProjectSnapshot): string[] {
  switch (step) {
    case 1: {
      const errors: string[] = []
      if (!data.category) errors.push("Category is required")
      if (!data.service) errors.push("Service is required")
      if (!data.title?.trim()) errors.push("Title is required")
      else if (data.title.trim().length < 30) errors.push("Title must be at least 30 characters")
      if (!data.description?.trim()) errors.push("Description is required")
      else if (data.description.trim().length < 100) {
        errors.push(`Description must be at least 100 characters (currently ${data.description.trim().length})`)
      }
      const isRenovation = (data.category || "").toLowerCase() === "renovation"
      if (!isRenovation && !data.priceModel) errors.push("Price model is required")
      if (!data.distance?.address?.trim()) errors.push("Service address is required")
      if (!data.distance?.maxKmRange || data.distance.maxKmRange <= 0) {
        errors.push("Maximum service range is required")
      }
      if (!Array.isArray(data.resources) || data.resources.length === 0) {
        errors.push("At least one team member must be assigned for execution")
      }
      if (isRenovation && (!data.intakeMeeting?.resources || data.intakeMeeting.resources.length === 0)) {
        errors.push("At least one intake meeting resource is required for renovation")
      }
      return errors
    }
    case 2: {
      if (!data.subprojects || data.subprojects.length === 0) {
        return ["At least one package / subproject is required"]
      }
      return data.subprojects.flatMap((sub, index) => collectSubprojectErrors(sub, index))
    }
    case 3: {
      const errors: string[] = []
      if (!data.customerPresence) errors.push("Customer presence selection is required")
      for (const [index, option] of (data.extraOptions || []).entries()) {
        if (!option.name?.trim()) errors.push(`Extra option ${index + 1}: name is required`)
        if (option.price == null || option.price < 0) errors.push(`Extra option ${index + 1}: price is required`)
      }
      for (const [index, term] of (data.termsConditions || []).entries()) {
        if (!term.name?.trim()) errors.push(`Term ${index + 1}: name is required`)
        if (!term.description?.trim()) errors.push(`Term ${index + 1}: description is required`)
      }
      return errors
    }
    case 4:
      return (data.faq || [])
        .map((item, index) => {
          if (!item.question?.trim() || !item.answer?.trim()) {
            return `FAQ ${index + 1}: question and answer are both required`
          }
          return null
        })
        .filter((message): message is string => Boolean(message))
    case 5:
      return (data.rfqQuestions || [])
        .map((item, index) => {
          if (!item.question?.trim()) return `RFQ question ${index + 1}: question text is required`
          if (item.type === "multiple_choice" && (!item.options || item.options.filter(Boolean).length < 2)) {
            return `RFQ question ${index + 1}: add at least two choices`
          }
          return null
        })
        .filter((message): message is string => Boolean(message))
    case 6:
      return (data.postBookingQuestions || [])
        .map((item, index) => {
          if (!item.question?.trim()) return `Post-booking question ${index + 1}: question text is required`
          if (item.type === "multiple_choice" && (!item.options || item.options.filter(Boolean).length < 2)) {
            return `Post-booking question ${index + 1}: add at least two choices`
          }
          return null
        })
        .filter((message): message is string => Boolean(message))
    default:
      return []
  }
}

const REQUIRED_STEPS = [1, 2, 3]
const OPTIONAL_CONTENT_STEPS = [4, 5, 6]

export function collectBlockingWizardErrors(data: WizardProjectSnapshot): WizardStepError[] {
  const blocking: WizardStepError[] = []
  for (const step of REQUIRED_STEPS) {
    const messages = collectStepErrors(step, data)
    if (messages.length > 0) {
      blocking.push({ step, stepTitle: WIZARD_STEP_TITLES[step], messages })
    }
  }
  for (const step of OPTIONAL_CONTENT_STEPS) {
    const messages = collectStepErrors(step, data)
    if (messages.length > 0) {
      blocking.push({ step, stepTitle: WIZARD_STEP_TITLES[step], messages })
    }
  }
  return blocking
}

export function formatWizardErrorToast(errors: WizardStepError[]): string {
  return errors
    .map((entry) => `Step ${entry.step} (${entry.stepTitle}): ${entry.messages.join("; ")}`)
    .join(" | ")
}

export function mapBackendFieldToStep(path: string): number {
  const lower = path.toLowerCase()
  if (lower.includes("subproject")) return 2
  if (lower.includes("extraoption") || lower.includes("termscondition") || lower.includes("customerpresence")) return 3
  if (lower.includes("faq")) return 4
  if (lower.includes("rfq")) return 5
  if (lower.includes("postbooking")) return 6
  return 1
}

export function parseProjectSaveError(payload: {
  error?: unknown
  details?: unknown
  qualityChecks?: Array<{ message?: string }>
}): { messages: string[]; step: number } {
  const messages: string[] = []
  if (Array.isArray(payload.qualityChecks)) {
    for (const check of payload.qualityChecks) {
      if (check?.message) messages.push(check.message)
    }
  }
  const details = typeof payload.details === "string" ? payload.details : ""
  const error = typeof payload.error === "string" ? payload.error : ""
  const blob = [details, error].filter(Boolean).join(" ")
  if (details) messages.push(details)

  if (messages.length === 0) {
    messages.push(error || "Could not save the project. Check the highlighted step and try again.")
  }

  const pathMatch = blob.match(/subprojects|faq|rfq|postBooking|extraOptions|termsConditions|title|description|distance|service/i)
  const step = pathMatch ? mapBackendFieldToStep(pathMatch[0]) : 2
  return { messages, step }
}
