export interface ClosingCondition {
    id: string;
    pass: boolean;
    detail: string[];
}

export interface ClosingReadiness {
    canClose: boolean;
    conditions: ClosingCondition[];
}