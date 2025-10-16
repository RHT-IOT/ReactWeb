import React, { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import mapData from '../../public/3dmodel/China.json' // 确保路径正确

const Map3DComponent: React.FC = () => {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.EChartsType | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // 初始化实例
    const chart = echarts.init(chartRef.current)
    chartInstanceRef.current = chart

    // 注册地图（必须在 setOption 前）
    echarts.registerMap('chinaMap', mapData as any)

    const option: echarts.EChartsOption = {
      title: {
        text: '3D中国地图',
        left: 'center',
        textStyle: { color: '#fff' },
      },
      tooltip: {
        show: true,
        formatter: (params: any) => params.name || '',
      },
      series: [
        {
          name: '中国',
          type: 'map3D',
          map: 'chinaMap',
          regionHeight: 2,
          shading: 'realistic',
          realisticMaterial: {
            roughness: 0.8,
            metalness: 0,
          },
          itemStyle: {
            color: '#1E90FF',
            borderWidth: 0.5,
            borderColor: '#fff',
          },
          emphasis: {
            itemStyle: {
              color: '#FFD700',
            },
            label: {
              show: true,
              textStyle: {
                color: '#000',
                fontSize: 14,
              },
            },
          },
          viewControl: {
            distance: 100,
            alpha: 40,
            beta: 10,
          },
        },
        {
          type: "scatter",
          zoom: 1,
          coordinateSystem: "geo",
          data: [
            {
              name: "天府新区",
              value: [104.11399841308594, 30.407471430197215], //图标坐标及大小
              type: "iconData",
            },
            {
              name: "东部新区",
              value: [104.35875962495804, 30.32959455353757],
              type: "iconData",
            },
            {
              name: "高新南区",
              value: [104.04893657684326, 30.608679048796095],
              type: "iconData",
            },
          ],
          symbol:'image://data:image/png;base64,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',//图片路劲，必须用BASE64编码格式！！！！
          z: 2,
          //  symbolOffset: [0, -40], //偏移量
          symbolSize: [20, 30], // symbols图标大小
        },
      ],
    }

    chart.setOption(option)

    // 点击事件
    chart.on('click', (params: any) => {
      if (params.name) {
        alert(`你点击了：${params.name}`)
      }
    })

    // 自适应
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
    }
  }, [])

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height: '100vh', background: '#000' }}
    />
  )
}

export default Map3DComponent
