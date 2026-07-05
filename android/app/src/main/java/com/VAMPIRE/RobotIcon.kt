package com.VAMPIRE

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@Composable
fun RobotIcon(
    modifier: Modifier = Modifier
) {
    val gradientColors = listOf(
        Color(0xFFFF1D5E), // Pink/Red
        Color(0xFFFF9E00), // Orange
        Color(0xFFFEF600), // Yellow
        Color(0xFF00FF85), // Greenish
        Color(0xFF00D1FF), // Cyan/Blue
        Color(0xFF9D00FF), // Purple
        Color(0xFFFF1D5E)  // Back to Pink
    )

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(64.dp))
            .background(
                brush = Brush.linearGradient(
                    colors = gradientColors,
                    start = Offset(0f, 0f),
                    end = Offset.Infinite
                )
            )
            .padding(48.dp)
    ) {
        // R is imported automatically from the package or needs to be referenced if in another package.
        // Since we changed the package to com.VAMPIRE and namespace is also com.VAMPIRE, it should be fine.
        val contentDescription = stringResource(id = R.string.robot_icon_content_description)
        Canvas(
            modifier = Modifier
                .fillMaxSize()
        ) {
            val strokeWidth = 14.dp.toPx()
            val white = Color.White

            // Head outline - drawing it slightly "wobbly" for hand-drawn effect
            val headPath = Path().apply {
                moveTo(size.width * 0.22f, size.height * 0.35f)
                quadraticBezierTo(size.width * 0.18f, size.height * 0.55f, size.width * 0.22f, size.height * 0.78f)
                quadraticBezierTo(size.width * 0.25f, size.height * 0.92f, size.width * 0.5f, size.height * 0.92f)
                quadraticBezierTo(size.width * 0.75f, size.height * 0.92f, size.width * 0.78f, size.height * 0.78f)
                quadraticBezierTo(size.width * 0.82f, size.height * 0.55f, size.width * 0.78f, size.height * 0.35f)
                quadraticBezierTo(size.width * 0.75f, size.height * 0.28f, size.width * 0.5f, size.height * 0.28f)
                quadraticBezierTo(size.width * 0.25f, size.height * 0.28f, size.width * 0.22f, size.height * 0.35f)
            }
            drawPath(
                path = headPath,
                color = white,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round, join = StrokeJoin.Round)
            )

            // Antennae - Left
            drawLine(
                color = white,
                start = Offset(size.width * 0.38f, size.height * 0.28f),
                end = Offset(size.width * 0.2f, size.height * 0.12f),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )
            drawCircle(
                color = white,
                radius = strokeWidth * 1.1f,
                center = Offset(size.width * 0.2f, size.height * 0.12f)
            )

            // Antennae - Right
            drawLine(
                color = white,
                start = Offset(size.width * 0.62f, size.height * 0.28f),
                end = Offset(size.width * 0.8f, size.height * 0.12f),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )
            drawCircle(
                color = white,
                radius = strokeWidth * 1.1f,
                center = Offset(size.width * 0.8f, size.height * 0.12f)
            )

            // Crown
            val crownPath = Path().apply {
                moveTo(size.width * 0.4f, size.height * 0.22f)
                lineTo(size.width * 0.35f, size.height * 0.14f)
                lineTo(size.width * 0.45f, size.height * 0.2f)
                lineTo(size.width * 0.5f, size.height * 0.1f)
                lineTo(size.width * 0.55f, size.height * 0.2f)
                lineTo(size.width * 0.65f, size.height * 0.14f)
                lineTo(size.width * 0.6f, size.height * 0.22f)
            }
            drawPath(
                path = crownPath,
                color = white,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round, join = StrokeJoin.Round)
            )

            // Eyes - X
            val eyeSize = size.width * 0.1f
            // Left eye
            val leftEyeX = size.width * 0.4f
            val eyeY = size.height * 0.48f
            drawLine(
                color = white,
                start = Offset(leftEyeX - eyeSize/2, eyeY - eyeSize/2),
                end = Offset(leftEyeX + eyeSize/2, eyeY + eyeSize/2),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )
            drawLine(
                color = white,
                start = Offset(leftEyeX + eyeSize/2, eyeY - eyeSize/2),
                end = Offset(leftEyeX - eyeSize/2, eyeY + eyeSize/2),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )

            // Right eye
            val rightEyeX = size.width * 0.6f
            drawLine(
                color = white,
                start = Offset(rightEyeX - eyeSize/2, eyeY - eyeSize/2),
                end = Offset(rightEyeX + eyeSize/2, eyeY + eyeSize/2),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )
            drawLine(
                color = white,
                start = Offset(rightEyeX + eyeSize/2, eyeY - eyeSize/2),
                end = Offset(rightEyeX - eyeSize/2, eyeY + eyeSize/2),
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round
            )

            // Mouth
            val mouthPath = Path().apply {
                moveTo(size.width * 0.38f, size.height * 0.68f)
                quadraticBezierTo(size.width * 0.5f, size.height * 0.88f, size.width * 0.62f, size.height * 0.68f)
                close()
            }
            drawPath(
                path = mouthPath,
                color = white,
                style = Stroke(width = strokeWidth, cap = StrokeCap.Round, join = StrokeJoin.Round)
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun RobotIconPreview() {
    MaterialTheme {
        RobotIcon(
            modifier = Modifier.padding(16.dp)
        )
    }
}
