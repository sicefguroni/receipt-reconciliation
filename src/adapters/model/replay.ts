import { DEFAULT_RECORDINGS_DIR, readRecording, requestKey } from "./recordings";
import {
  type ModelCall,
  type ModelClient,
  type ModelResponse,
  RecordingMissingError,
} from "./types";

/** Serves recorded responses by request key and fails loudly on a miss (04, "Replay mode"). */
export class ReplayModelClient implements ModelClient {
  readonly mode = "replay" as const;

  constructor(private readonly dir = DEFAULT_RECORDINGS_DIR) {}

  async call(request: ModelCall): Promise<ModelResponse> {
    const key = requestKey(request);
    const recorded = readRecording(this.dir, key);
    if (!recorded) throw new RecordingMissingError(key, request.task);
    return recorded;
  }
}
