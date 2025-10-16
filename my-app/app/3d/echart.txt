import React, { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import mapData from '../../public/3dmodel/China.json' // 确保路径正确
import hkData from '../../public/3dmodel/HongKong.json' // 确保路径正确
import macauData from '../../public/3dmodel/Macau.json' // 确保路径正确

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
      ],
    }

    chart.setOption(option)

    // 点击事件
    chart.on('click', (params: any) => {
      if (params.name) {
        console.log("你点击了",params.name);
      }
      if(params.name === "澳门特别行政区"){
        echarts.registerMap('macauMap', macauData as any);

        // 更新配置，切换到香港地图
        chart.setOption({
          title: {
            text: '3D澳门地图',
            left: 'center',
            textStyle: { color: '#fff' },
          },
          series: [
            {
              name: '澳门',
              type: 'map3D',
              map: 'macauMap',          // ✅ use the new map name
              regionHeight: 2,
              shading: 'realistic',
              realisticMaterial: { roughness: 0.8, metalness: 0 },
              itemStyle: {
                color: '#1E90FF',
                borderWidth: 0.5,
                borderColor: '#fff',
              },
              emphasis: {
                itemStyle: { color: '#FFD700' },
                label: { show: true, textStyle: { color: '#000', fontSize: 14 } },
              },
              viewControl: { distance: 100, alpha: 40, beta: 10 },
            },
          ],
        }, true); // true = notMerge, replace old option
      }
      if (params.name === "香港特别行政区") {   
        console.log("切换到香港地图");

    // 注册香港地图
    echarts.registerMap('hkMap', hkData as any);

    // 更新配置，切换到香港地图
    chart.setOption({
      title: {
        text: '3D香港地图',
        left: 'center',
        textStyle: { color: '#fff' },
      },
      series: [
        {
          name: '香港',
          type: 'map3D',
          map: 'hkMap',          // ✅ use the new map name
          regionHeight: 2,
          shading: 'realistic',
          realisticMaterial: { roughness: 0.8, metalness: 0 },
          itemStyle: {
            color: '#1E90FF',
            borderWidth: 0.5,
            borderColor: '#fff',
          },
          emphasis: {
            itemStyle: { color: '#FFD700' },
            label: { show: true, textStyle: { color: '#000', fontSize: 14 } },
          },
          viewControl: { distance: 100, alpha: 40, beta: 10 },
        },
      ],
    }, true); // true = notMerge, replace old option
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
