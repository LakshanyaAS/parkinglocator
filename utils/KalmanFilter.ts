export class KalmanFilter {
  private R: number; // measurement noise
  private Q: number; // process noise
  private A: number; // state transition
  private B: number; // control input
  private C: number; // measurement mapping

  private cov: number = NaN;
  private x: number = NaN;

  constructor(R = 0.01, Q = 3) {
    this.R = R; 
    this.Q = Q;
    this.A = 1;
    this.B = 0;
    this.C = 1;
  }

  filter(z: number, u = 0): number {
    if (isNaN(this.x)) {
      this.x = (1 / this.C) * z;
      this.cov = (1 / this.C) * this.Q * (1 / this.C);
    } else {
      // Prediction
      const predX = this.A * this.x + this.B * u;
      const predCov = this.A * this.cov * this.A + this.R;

      // Kalman Gain
      const K = predCov * this.C / (this.C * predCov * this.C + this.Q);

      // Correction
      this.x = predX + K * (z - this.C * predX);
      this.cov = predCov - K * this.C * predCov;
    }

    return this.x;
  }
}
