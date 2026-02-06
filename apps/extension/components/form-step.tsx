import { Button } from "@crikket/ui/components/ui/button"
import { Label } from "@crikket/ui/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import { Textarea } from "@crikket/ui/components/ui/textarea"

export type Priority = "low" | "medium" | "high" | "critical"

interface FormStepProps {
  captureType: "video" | "screenshot"
  description: string
  priority: Priority
  previewUrl: string | null
  isSubmitting: boolean
  submitError: string | null
  onDescriptionChange: (value: string) => void
  onPriorityChange: (value: Priority) => void
  onSubmit: () => void
  onCancel: () => void
}

export function FormStep({
  captureType,
  description,
  priority,
  previewUrl,
  isSubmitting,
  submitError,
  onDescriptionChange,
  onPriorityChange,
  onSubmit,
  onCancel,
}: FormStepProps) {
  return (
    <div className="space-y-6">
      {/* Preview */}
      {previewUrl && (
        <div className="overflow-hidden rounded-lg border bg-black">
          {captureType === "video" ? (
            <video
              className="w-full"
              controls
              src={previewUrl}
              style={{ maxHeight: "400px" }}
            >
              <track kind="captions" />
            </video>
          ) : (
            <img
              alt="Screenshot preview"
              className="w-full"
              src={previewUrl}
              style={{ maxHeight: "400px", objectFit: "contain" }}
            />
          )}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            className="resize-none"
            id="description"
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onDescriptionChange(e.target.value)
            }
            placeholder="Describe what went wrong..."
            rows={4}
            value={description}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            onValueChange={(value) => {
              if (value) onPriorityChange(value as Priority)
            }}
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
      </div>

      {/* Error */}
      {submitError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-red-400 text-sm">{submitError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          className="flex-1"
          disabled={isSubmitting}
          onClick={onCancel}
          variant="outline"
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
