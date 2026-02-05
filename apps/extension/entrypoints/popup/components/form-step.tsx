import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"
import { Label } from "@crikket/ui/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import { Textarea } from "@crikket/ui/components/ui/textarea"
import type { Priority } from "../types"

interface FormStepProps {
  previewUrl: string | null
  captureType: "video" | "screenshot"
  description: string
  onDescriptionChange: (value: string) => void
  priority: Priority
  onPriorityChange: (value: Priority) => void
  submitError: string | null
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: () => void
}

export function FormStep({
  previewUrl,
  captureType,
  description,
  onDescriptionChange,
  priority,
  onPriorityChange,
  submitError,
  isSubmitting,
  onCancel,
  onSubmit,
}: FormStepProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Preview */}
      {previewUrl && (
        <Card>
          <CardContent className="overflow-hidden rounded-lg p-0">
            {captureType === "video" ? (
              <video
                className="max-h-[180px] w-full object-contain"
                controls
                muted
                src={previewUrl}
              />
            ) : (
              <img
                alt="Screenshot"
                className="max-h-[180px] w-full object-contain"
                src={previewUrl}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe the bug..."
          rows={3}
          value={description}
        />
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priority">Priority</Label>
        <Select
          onValueChange={(value) => onPriorityChange(value as Priority)}
          value={priority}
        >
          <SelectTrigger id="priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {submitError && (
        <Card className="border-destructive/30 bg-destructive/15">
          <CardContent className="p-3 text-destructive text-sm">
            {submitError}
          </CardContent>
        </Card>
      )}

      <div className="mt-2 flex gap-2.5">
        <Button
          className="flex-1"
          disabled={isSubmitting}
          onClick={onCancel}
          variant="secondary"
        >
          Cancel
        </Button>
        <Button className="flex-1" disabled={isSubmitting} onClick={onSubmit}>
          {isSubmitting ? "Submitting..." : "Submit Bug Report"}
        </Button>
      </div>
    </div>
  )
}
